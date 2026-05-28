const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const logger = require('../logger');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

// ==================== MIDDLEWARE DI AUTENTICAZIONE ====================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token non fornito' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token non valido' });
        }
        req.user = user;
        next();
    });
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Registra un nuovo utente
 *     description: Crea un nuovo account utente con email, password e ruolo. Richiede accettazione privacy.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - privacy_accepted
 *             properties:
 *               username:
 *                 type: string
 *                 description: Nome utente univoco (3+ caratteri)
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 description: Password (6+ caratteri)
 *               role:
 *                 type: string
 *                 enum: [admin, manager, operator, viewer]
 *                 default: operator
 *               privacy_accepted:
 *                 type: boolean
 *                 description: Accettazione della privacy (richiesto)
 *     responses:
 *       201:
 *         description: Utente registrato con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT token (7 giorni expiry)
 *       400:
 *         description: Dati invalidi o utente già esistente
 *       500:
 *         description: Errore del server
 */
// POST /api/auth/register - Registrazione utente
router.post('/register', async (req, res) => {
    const { username, email, password, role, user_type, azienda_data, parent_username, privacy_accepted } = req.body;
    let { parent_id } = req.body;

    // ✅ Se la richiesta arriva da un utente già autenticato (creazione sotto-utente),
    //    eredita parent_id e privacy dal genitore (che ha già accettato la privacy).
    let inheritedPrivacy = false;
    let inheritedFromParent = null;
    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader && authHeader.split(' ')[1];
    if (bearerToken) {
        try {
            const decoded = jwt.verify(bearerToken, JWT_SECRET);
            const parentUser = await db.getAsync(
                'SELECT id, username, privacy_accepted FROM users WHERE id = ?',
                [decoded.id]
            );
            if (parentUser && parentUser.privacy_accepted) {
                inheritedPrivacy = true;
                inheritedFromParent = parentUser;
                // Forza parent_id a quello del creatore (il client non può falsificarlo)
                parent_id = parentUser.id;
            }
        } catch (e) {
            // Token invalido → trattiamo come registrazione pubblica (verrà richiesta privacy)
        }
    }

    // ✅ VALIDAZIONE PRIVACY (solo se NON ereditata dal genitore già autenticato)
    if (!inheritedPrivacy && !privacy_accepted) {
        return res.status(400).json({
            error: 'È necessario accettare l\'informativa sulla privacy per registrarsi'
        });
    }

    // Validazioni esistenti...
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email e password sono obbligatori' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
    }

    // Verifica username univoco
    const existingUser = await db.getAsync('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
        return res.status(400).json({ error: 'Username già esistente' });
    }

    // Verifica email univoca
    const existingEmail = await db.getAsync('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) {
        return res.status(400).json({ error: 'Email già registrata' });
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();

    const finalParentUsername = inheritedFromParent
        ? inheritedFromParent.username
        : (parent_username || null);

    // ✅ AUTO-PROMOZIONE PRIMO UTENTE AD ADMIN
    // Se non esistono altri utenti nel DB (oltre eventualmente al super-admin 'admin' di seed),
    // il primo utente che si registra pubblicamente diventa amministratore.
    let finalRole = role || 'visitatore';
    if (!inheritedFromParent) {
        const otherUsersCount = await db.getAsync(
            "SELECT COUNT(*) as c FROM users WHERE username != 'admin'"
        );
        if ((otherUsersCount?.c || 0) === 0) {
            finalRole = 'admin';
        }
    }

    // ✅ INSERISCI CON PRIVACY
    const result = await db.runAsync(
        `INSERT INTO users (username, email, password_hash, role, user_type, azienda_data, parent_id, parent_username, privacy_accepted, privacy_accepted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, email, hashedPassword, finalRole, user_type || 'libero_professionista',
         azienda_data ? JSON.stringify(azienda_data) : null, parent_id || null, finalParentUsername,
         1, now, now]
    );

    // Genera token JWT
    const token = jwt.sign(
        { id: result.id, username, email, role: finalRole },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    // ✅ INVIO EMAIL CREDENZIALI (se richiesto e SMTP configurato)
    let emailSent = false;
    if (req.body.send_credentials_email && transporter && email) {
        try {
            const publicUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
            await transporter.sendMail({
                from: process.env.SMTP_FROM || 'no-reply@cropbook.local',
                to: email,
                subject: 'Cropbook — Le tue credenziali di accesso',
                text: `Ciao ${username},\n\nÈ stato creato un account Cropbook per te.\n\n  • Username: ${username}\n  • Password: ${password}\n  • Ruolo: ${finalRole}\n\nPer accedere apri: ${publicUrl}\n\nTi consigliamo di cambiare la password al primo accesso.`,
                html: `<p>Ciao <b>${username}</b>,</p><p>È stato creato un account Cropbook per te.</p><ul><li><b>Username:</b> ${username}</li><li><b>Password:</b> <code>${password}</code></li><li><b>Ruolo:</b> ${finalRole}</li></ul><p>Per accedere apri: <a href="${publicUrl}">${publicUrl}</a></p><p style="color:#888;font-size:.9em">Ti consigliamo di cambiare la password al primo accesso.</p>`
            });
            emailSent = true;
            logger.info('Email credenziali inviata', { username, email });
        } catch (mailErr) {
            logger.error('Errore invio email credenziali', { error: mailErr.message });
        }
    }

    res.status(201).json({
        success: true,
        message: 'Utente registrato con successo',
        token,
        user: { id: result.id, username, email, role: finalRole, parent_id: parent_id || null },
        inherited_privacy: inheritedPrivacy,
        email_sent: emailSent,
        auto_promoted_admin: finalRole === 'admin' && (!role || role !== 'admin')
    });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login utente
 *     description: Autentica un utente e ritorna un JWT token valido per 7 giorni.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login riuscito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT bearer token (7 giorni expiry)
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Credenziali non valide
 *       500:
 *         description: Errore del server
 */
// POST /api/auth/login - Login utente
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username e password sono obbligatori' });
    }

    // Cerca utente
    const user = await db.getAsync(
        'SELECT id, username, email, password_hash, role, user_type, azienda_data FROM users WHERE username = ?',
        [username]
    );

    if (!user) {
        return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Verifica password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
        return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Genera token JWT
    const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
        success: true,
        message: 'Login effettuato con successo',
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            user_type: user.user_type,
            azienda_data: user.azienda_data ? JSON.parse(user.azienda_data) : null
        }
    });
});

/**
 * @swagger
 * /api/auth/verify:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verifica validità del token
 *     description: Controlla se un JWT token è ancora valido e ritorna i dati dell'utente.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Token non valido o scaduto
 */
// POST /api/auth/verify - Verifica token (per frontend)
router.post('/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token non fornito' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await db.getAsync(
            'SELECT id, username, email, role, user_type FROM users WHERE id = ?',
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ error: 'Utente non trovato' });
        }

        res.json({ valid: true, user });
    } catch (error) {
        res.status(401).json({ valid: false, error: 'Token non valido' });
    }
});

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Elenca gli utenti
 *     description: |
 *       Ritorna la lista degli utenti. Solo admin possono accedere.
 *       - Super-admin (username: 'admin') vede tutti gli utenti
 *       - Admin normali vedono solo i loro sottoutenti (creati da loro)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista utenti
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: Accesso negato. Solo admin.
 *       500:
 *         description: Errore del server
 */
// GET /api/auth/users - Lista utenti (solo admin)
// Se admin normale, vede solo i suoi sottoutenti (parent_id = suo id)
// Se super-admin (username 'admin') vede tutti
router.get('/users', authenticateToken, async (req, res) => {
    try {
        // Solo admin può vedere la lista utenti
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accesso negato. Solo gli amministratori possono visualizzare la lista utenti.' });
        }
        
        let users;
        
        // Se è il super-admin (username 'admin'), vede tutti gli utenti
        if (req.user.username === 'admin') {
            users = await db.allAsync(
    'SELECT id, username, email, role, user_type, azienda_data, parent_id, parent_username, privacy_accepted, privacy_accepted_at, created_at FROM users ORDER BY created_at DESC'
);
        } else {
            // Altrimenti vede solo i suoi sottoutenti (quelli che ha creato lui)
            users = await db.allAsync(
    'SELECT id, username, email, role, user_type, azienda_data, parent_id, parent_username, privacy_accepted, privacy_accepted_at, created_at FROM users WHERE parent_id = ? OR id = ? ORDER BY created_at DESC',
    [req.user.id, req.user.id]
);
        }
        
        res.json({ data: users });
    } catch (error) {
        console.error('Errore GET users:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== MODIFICA 6 - NUOVE ROUTE ====================

// PUT /api/auth/users/:id/role - Aggiorna ruolo utente (solo admin)
router.put('/users/:id/role', authenticateToken, async (req, res) => {
    // Solo admin può farlo
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato. Solo gli amministratori possono modificare i ruoli.' });
    }
    
    const { id } = req.params;
    const { role } = req.body;
    
    // Valida il ruolo
    if (!['admin', 'operatore', 'visitatore'].includes(role)) {
        return res.status(400).json({ error: 'Ruolo non valido. I ruoli accettati sono: admin, operatore, visitatore' });
    }
    
    // Non permettere di modificare il proprio ruolo
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Non puoi modificare il tuo stesso ruolo' });
    }
    
    try {
        // Verifica che l'utente esista e ottieni parent_id
        const user = await db.getAsync('SELECT id, parent_id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }
        
        // ✅ CONTROLLO: Se non è super-admin (username 'admin'), può modificare solo i suoi sottoutenti
        if (req.user.username !== 'admin' && user.parent_id !== req.user.id) {
            return res.status(403).json({ error: 'Non puoi modificare utenti creati da altri amministratori' });
        }
        
        // Aggiorna il ruolo
        await db.runAsync('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        
        res.json({ 
            success: true, 
            message: 'Ruolo aggiornato con successo',
            user_id: id,
            new_role: role
        });
    } catch (error) {
        console.error('Errore aggiornamento ruolo:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// DELETE /api/auth/users/:id - Elimina utente e tutti i dati associati (solo admin/sviluppatore)
router.delete('/users/:id', authenticateToken, async (req, res) => {
    // Solo admin o sviluppatore può farlo
    if (req.user.role !== 'admin' && req.user.username !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato. Solo gli amministratori possono eliminare utenti.' });
    }
    
    const { id } = req.params;
    const userId = parseInt(id);
    
    // Non permettere di eliminare se stesso
    if (userId === req.user.id) {
        return res.status(400).json({ error: 'Non puoi eliminare il tuo account' });
    }
    
    try {
        // Verifica che l'utente esista
        const user = await db.getAsync('SELECT id, username, role, parent_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        // ✅ CONTROLLO scope: super-admin può cancellare chiunque, admin "normale" solo i propri sotto-utenti
        if (req.user.username !== 'admin' && user.parent_id !== req.user.id) {
            return res.status(403).json({ error: 'Non puoi eliminare utenti creati da altri amministratori' });
        }

        logger.info('Eliminazione utente', { username: user.username, userId });

        const result = await db.withTransaction(async () => {
            // 1. Elimina dati dei lotti dell'utente
            await db.runAsync(`DELETE FROM activities WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [userId, user.username]);
            await db.runAsync(`DELETE FROM analyses WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [userId, user.username]);
            await db.runAsync(`DELETE FROM economic_records WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [userId, user.username]);
            await db.runAsync(`DELETE FROM lot_details WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [userId, user.username]);
            const lotsDeleted = await db.runAsync(`DELETE FROM lots WHERE owner_id = ? OR owner_username = ?`, [userId, user.username]);

            // 2. Elimina i sotto-utenti e i loro dati
            const subUsers = await db.allAsync('SELECT id, username FROM users WHERE parent_id = ?', [userId]);
            for (const subUser of subUsers) {
                await db.runAsync(`DELETE FROM activities WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [subUser.id, subUser.username]);
                await db.runAsync(`DELETE FROM analyses WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [subUser.id, subUser.username]);
                await db.runAsync(`DELETE FROM economic_records WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [subUser.id, subUser.username]);
                await db.runAsync(`DELETE FROM lot_details WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [subUser.id, subUser.username]);
                await db.runAsync(`DELETE FROM lots WHERE owner_id = ? OR owner_username = ?`, [subUser.id, subUser.username]);
            }
            const subUsersDeleted = await db.runAsync('DELETE FROM users WHERE parent_id = ?', [userId]);

            // 3. Elimina l'utente principale
            await db.runAsync('DELETE FROM users WHERE id = ?', [userId]);

            return { lotsDeleted: lotsDeleted.changes, subUsersDeleted: subUsersDeleted.changes };
        });

        logger.info('Utente eliminato', { username: user.username, ...result });

        res.json({
            success: true,
            message: `Utente ${user.username} eliminato con successo`,
            deleted_id: userId,
            deleted_lots: result.lotsDeleted,
            deleted_subusers: result.subUsersDeleted
        });

    } catch (error) {
        logger.error('Errore eliminazione utente', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ✅ Configurazione SMTP da ENV (no credenziali in chiaro nel codice)
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

// POST /api/auth/forgot-password - Richiede reset password
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email obbligatoria' });
    }

    try {
        // Cerca utente per email
        const user = await db.getAsync(
            'SELECT id, username, email FROM users WHERE email = ?',
            [email]
        );

        // Per sicurezza, rispondiamo sempre uguale (non rivelare se l'email esiste)
        const genericResponse = { success: true, message: "Se l'email è registrata riceverai un link di reset" };

        if (!user) return res.json(genericResponse);

        // Genera token unico
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 ora

        await db.runAsync(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
            [user.id, token, expiresAt.toISOString()]
        );

        const publicUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
        const resetLink = `${publicUrl}/reset-password.html?token=${token}`;

        // Invio email se SMTP configurato
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || 'no-reply@cropbook.local',
                    to: user.email,
                    subject: 'Cropbook — Reset password',
                    text: `Ciao ${user.username},\n\nApri questo link per impostare una nuova password (valido 1 ora):\n${resetLink}\n\nSe non hai richiesto il reset, ignora questa email.`,
                    html: `<p>Ciao <b>${user.username}</b>,</p><p>Apri questo link per impostare una nuova password (valido 1 ora):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Se non hai richiesto il reset, ignora questa email.</p>`
                });
                logger.info('Email reset password inviata', { userId: user.id });
            } catch (mailErr) {
                logger.error('Errore invio email reset', { error: mailErr.message });
            }
        }

        // ⚠️ Stampa link in console SOLO in dev
        if (process.env.NODE_ENV !== 'production') {
            logger.warn('🔐 RESET PASSWORD LINK (dev only)', { resetLink });
        }

        res.json(genericResponse);
    } catch (error) {
        logger.error('Errore forgot-password', { error: error.message });
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// POST /api/auth/reset-password - Conferma reset password
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token e nuova password obbligatori' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
    }
    
    try {
        // Verifica token
        const resetToken = await db.getAsync(
            `SELECT * FROM password_reset_tokens 
             WHERE token = ? AND used = 0 AND expires_at > datetime('now')`,
            [token]
        );
        
        if (!resetToken) {
            return res.status(400).json({ error: 'Token non valido o scaduto' });
        }
        
        // Aggiorna password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.runAsync(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedPassword, resetToken.user_id]
        );
        
        // Marca token come usato
        await db.runAsync(
            'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
            [resetToken.id]
        );
        
        res.json({ success: true, message: 'Password aggiornata con successo' });
    } catch (error) {
        console.error('Errore reset-password:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// POST /api/auth/admin-reset-password - Reset forzato (solo super-admin)
router.post('/admin-reset-password', authenticateToken, async (req, res) => {
    // Solo super-admin (username 'admin') può farlo
    if (req.user.username !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato. Solo il super-admin può resettare password.' });
    }
    
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
        return res.status(400).json({ error: 'ID utente e nuova password obbligatori' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.runAsync(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedPassword, userId]
        );
        
        res.json({ success: true, message: 'Password resettata con successo' });
    } catch (error) {
        console.error('Errore admin-reset-password:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

module.exports = router;
