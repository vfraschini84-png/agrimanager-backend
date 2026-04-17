const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const router = express.Router();

const JWT_SECRET = 'agrimanager_secret_key_change_this_in_production';
const SALT_ROUNDS = 10;

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

// POST /api/auth/register - Registrazione utente
router.post('/register', async (req, res) => {
    const { username, email, password, role, user_type, azienda_data, parent_id, parent_username } = req.body;

    // Validazioni
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

    // Inserisci utente
    const result = await db.runAsync(
    `INSERT INTO users (username, email, password_hash, role, user_type, azienda_data, parent_id, parent_username, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, email, hashedPassword, role || 'visitatore', user_type || 'libero_professionista', 
     azienda_data ? JSON.stringify(azienda_data) : null, parent_id || null, parent_username || null, new Date().toISOString()]
);

    // Genera token JWT
    const token = jwt.sign(
        { id: result.id, username, email, role: role || 'visitatore' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.status(201).json({
        success: true,
        message: 'Utente registrato con successo',
        token,
        user: { id: result.id, username, email, role: role || 'visitatore' }
    });
});

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
        { expiresIn: '7d' }
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
                'SELECT id, username, email, role, user_type, azienda_data, parent_id, parent_username, created_at FROM users ORDER BY created_at DESC'
            );
        } else {
            // Altrimenti vede solo i suoi sottoutenti (quelli che ha creato lui)
            users = await db.allAsync(
                'SELECT id, username, email, role, user_type, azienda_data, parent_id, parent_username, created_at FROM users WHERE parent_id = ? OR id = ? ORDER BY created_at DESC',
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

// DELETE /api/auth/users/:id - Elimina utente (solo admin)
router.delete('/users/:id', authenticateToken, async (req, res) => {
    // Solo admin può farlo
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato. Solo gli amministratori possono eliminare utenti.' });
    }
    
    const { id } = req.params;
    
    // Non permettere di eliminare se stesso
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Non puoi eliminare il tuo account' });
    }
    
    try {
        // Verifica che l'utente esista e ottieni parent_id
        const user = await db.getAsync('SELECT id, username, parent_id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }
        
        // ✅ CONTROLLO: Se non è super-admin (username 'admin'), può eliminare solo i suoi sottoutenti
        if (req.user.username !== 'admin' && user.parent_id !== req.user.id) {
            return res.status(403).json({ error: 'Non puoi eliminare utenti creati da altri amministratori' });
        }
        
        // Elimina l'utente
        await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
        
        res.json({ 
            success: true, 
            message: `Utente ${user.username} eliminato con successo`,
            deleted_id: id
        });
    } catch (error) {
        console.error('Errore eliminazione utente:', error);
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
        const user = await db.getAsync('SELECT id, username, role FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }
        
        console.log(`🗑️ Eliminazione utente: ${user.username} (ID: ${userId})`);
        
        // 1. Elimina i lotti dell'utente e dati correlati
        // 1a. Elimina attività di raccolta dei lotti dell'utente
        await db.runAsync(`
            DELETE FROM activities 
            WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)
        `, [userId, user.username]);
        
        // 1b. Elimina analisi dei lotti dell'utente
        await db.runAsync(`
            DELETE FROM analyses 
            WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)
        `, [userId, user.username]);
        
        // 1c. Elimina registrazioni economiche dei lotti dell'utente
        await db.runAsync(`
            DELETE FROM economic_records 
            WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)
        `, [userId, user.username]);
        
        // 1d. Elimina dettagli lotti
        await db.runAsync(`
            DELETE FROM lot_details 
            WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)
        `, [userId, user.username]);
        
        // 1e. Elimina i lotti dell'utente
        const lotsDeleted = await db.runAsync(`
            DELETE FROM lots WHERE owner_id = ? OR owner_username = ?
        `, [userId, user.username]);
        
        console.log(`📦 Eliminati ${lotsDeleted.changes} lotti per l'utente ${user.username}`);
        
        // 2. Elimina i sotto-utenti (quelli che hanno questo utente come parent)
        const subUsers = await db.allAsync('SELECT id, username FROM users WHERE parent_id = ?', [userId]);
        
        for (const subUser of subUsers) {
            // Elimina dati dei sotto-utenti
            await db.runAsync(`
                DELETE FROM activities 
                WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)
            `, [subUser.id, subUser.username]);
            await db.runAsync(`
                DELETE FROM analyses 
                WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)
            `, [subUser.id, subUser.username]);
            await db.runAsync(`
                DELETE FROM economic_records 
                WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)
            `, [subUser.id, subUser.username]);
            await db.runAsync(`
                DELETE FROM lots WHERE owner_id = ? OR owner_username = ?
            `, [subUser.id, subUser.username]);
        }
        
        // Elimina i sotto-utenti
        const subUsersDeleted = await db.runAsync('DELETE FROM users WHERE parent_id = ?', [userId]);
        console.log(`👥 Eliminati ${subUsersDeleted.changes} sotto-utenti di ${user.username}`);
        
        // 3. Elimina l'utente principale
        await db.runAsync('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({ 
            success: true, 
            message: `Utente ${user.username} eliminato con successo`,
            deleted_id: userId,
            deleted_lots: lotsDeleted.changes,
            deleted_subusers: subUsersDeleted.changes
        });
        
    } catch (error) {
        console.error('Errore eliminazione utente:', error);
        res.status(500).json({ error: 'Errore interno del server: ' + error.message });
    }
});

module.exports = router;