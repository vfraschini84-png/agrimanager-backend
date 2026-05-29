// routes/admin.js — Endpoint amministrazione DEV protetti server-side
// ⚠️ Tutti gli endpoint qui sono RISERVATI al super-admin (username='admin')
//    e richiedono SIA un JWT valido SIA un "dev session token" emesso dopo
//    autenticazione con DEV_PASSWORD lato server.
// In produzione: ENABLE_DEV_PANEL=false → tutti gli endpoint restituiscono 404.

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const logger = require('../logger');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const DEV_PASSWORD_HASH = process.env.DEV_PASSWORD_HASH;
const ENABLE_DEV_PANEL = process.env.ENABLE_DEV_PANEL !== 'false'; // default true

// ==================== AUDIT LOG ====================
// Log dedicato per audit accessi dev (file separato per evidenza)
const auditLogPath = path.resolve(__dirname, '..', '..', 'data', 'dev_audit.log');
try { fs.mkdirSync(path.dirname(auditLogPath), { recursive: true }); } catch (_) {}

function auditLog(action, req, extra = {}) {
    const entry = {
        ts: new Date().toISOString(),
        action,
        user: req.user?.username || 'anonymous',
        userId: req.user?.id || null,
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 200) || null,
        ...extra
    };
    try {
        fs.appendFileSync(auditLogPath, JSON.stringify(entry) + '\n');
    } catch (err) {
        logger.error('Errore scrittura audit log', { error: err.message });
    }
    logger.warn('🔒 DEV AUDIT', entry);
}

// ==================== RATE LIMITING DEDICATO ====================
const devAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // solo 5 tentativi in 15 min per IP
    message: { error: 'Troppi tentativi di accesso dev. Riprova fra 15 minuti.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        auditLog('rate_limit_hit', req, { endpoint: req.originalUrl });
        res.status(429).json({ error: 'Troppi tentativi. Riprova fra 15 minuti.' });
    }
});

const devApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { error: 'Rate limit superato' },
    standardHeaders: true,
    legacyHeaders: false
});

// ==================== MIDDLEWARE ====================
/**
 * Verifica che il dev panel sia abilitato. In produzione → 404 (non rivelare neanche l'esistenza).
 */
function requireDevPanelEnabled(req, res, next) {
    if (!ENABLE_DEV_PANEL) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
}

/**
 * Verifica JWT principale.
 */
function authenticateToken(req, res, next) {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token non fornito' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        return res.status(403).json({ error: 'Token non valido' });
    }
}

/**
 * Verifica che l'utente sia il SUPER-ADMIN (username='admin' E role='admin').
 */
function requireSuperAdmin(req, res, next) {
    if (!req.user || req.user.username !== 'admin' || req.user.role !== 'admin') {
        auditLog('access_denied_not_super_admin', req, { endpoint: req.originalUrl });
        return res.status(403).json({ error: 'Accesso negato' });
    }
    next();
}

/**
 * Verifica il "dev session token" inviato come header X-Dev-Token.
 * Questo token viene emesso dopo successo di POST /api/admin/dev/auth.
 * È un JWT separato con scope=dev e scadenza breve (30 min).
 */
function requireDevSession(req, res, next) {
    const devToken = req.headers['x-dev-token'];
    if (!devToken) {
        auditLog('dev_session_missing', req, { endpoint: req.originalUrl });
        return res.status(401).json({ error: 'Dev session token mancante' });
    }
    try {
        const decoded = jwt.verify(devToken, JWT_SECRET);
        if (decoded.scope !== 'dev' || decoded.sub !== req.user.id) {
            auditLog('dev_session_invalid_scope', req, { endpoint: req.originalUrl });
            return res.status(403).json({ error: 'Dev session token non valido' });
        }
        req.devSession = decoded;
        next();
    } catch (e) {
        auditLog('dev_session_expired', req, { endpoint: req.originalUrl });
        return res.status(403).json({ error: 'Dev session scaduta o invalida' });
    }
}

// ==================== ROUTE ====================

/**
 * POST /api/admin/dev/auth
 * Body: { password }
 * Risposta: { devToken } valido 30 minuti.
 * Richiede: JWT valido + utente=super-admin + DEV_PASSWORD_HASH configurato server-side.
 */
router.post('/dev/auth', requireDevPanelEnabled, devAuthLimiter, authenticateToken, requireSuperAdmin, async (req, res) => {
    if (!DEV_PASSWORD_HASH) {
        auditLog('dev_auth_not_configured', req);
        return res.status(503).json({ error: 'Dev panel non configurato sul server (manca DEV_PASSWORD_HASH).' });
    }

    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password obbligatoria' });
    }

    const ok = await bcrypt.compare(password, DEV_PASSWORD_HASH);
    if (!ok) {
        auditLog('dev_auth_failed', req);
        return res.status(403).json({ error: 'Password errata' });
    }

    // Emetti dev session token (JWT scope=dev, scadenza 30 min)
    const devToken = jwt.sign(
        { sub: req.user.id, scope: 'dev', user: req.user.username },
        JWT_SECRET,
        { expiresIn: '30m' }
    );

    auditLog('dev_auth_success', req);
    res.json({ devToken, expiresInSec: 1800 });
});

/**
 * GET /api/admin/dev/users
 * Lista completa utenti (solo metadati, NESSUNA password/hash).
 */
router.get('/dev/users', requireDevPanelEnabled, devApiLimiter, authenticateToken, requireSuperAdmin, requireDevSession, async (req, res) => {
    try {
        const rows = await db.allAsync(`
            SELECT id, username, email, role, user_type, azienda_data,
                   parent_id, parent_username, privacy_accepted, privacy_accepted_at, created_at
              FROM users
             ORDER BY created_at DESC
        `);
        auditLog('dev_users_list', req, { count: rows.length });
        res.json({ data: rows });
    } catch (error) {
        logger.error('Errore dev/users', { error: error.message });
        res.status(500).json({ error: 'Errore server' });
    }
});

/**
 * GET /api/admin/dev/stats
 * Aggregazioni: conteggi lotti, attività, registrazioni economiche, utenti per ruolo.
 */
router.get('/dev/stats', requireDevPanelEnabled, devApiLimiter, authenticateToken, requireSuperAdmin, requireDevSession, async (req, res) => {
    try {
        const stats = {};
        const queries = [
            ['totalUsers', 'SELECT COUNT(*) as c FROM users'],
            ['totalLots', 'SELECT COUNT(*) as c FROM lots'],
            ['totalActivities', 'SELECT COUNT(*) as c FROM activities'],
            ['totalAnalyses', 'SELECT COUNT(*) as c FROM analyses'],
            ['totalEconomic', 'SELECT COUNT(*) as c FROM economic_records']
        ];
        for (const [k, sql] of queries) {
            const row = await db.getAsync(sql);
            stats[k] = row?.c || 0;
        }
        const byRole = await db.allAsync(`SELECT role, COUNT(*) as c FROM users GROUP BY role`);
        stats.byRole = byRole;

        auditLog('dev_stats_view', req);
        res.json({ data: stats });
    } catch (error) {
        logger.error('Errore dev/stats', { error: error.message });
        res.status(500).json({ error: 'Errore server' });
    }
});

/**
 * POST /api/admin/dev/reset-password
 * Body: { userId, newPassword }
 * Permette al super-admin (autenticato anche su dev session) di resettare la pwd di un utente.
 */
router.post('/dev/reset-password', requireDevPanelEnabled, devApiLimiter, authenticateToken, requireSuperAdmin, requireDevSession, async (req, res) => {
    const { userId, newPassword } = req.body || {};
    if (!userId || !newPassword) return res.status(400).json({ error: 'userId e newPassword obbligatori' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password minimo 6 caratteri' });

    try {
        const target = await db.getAsync('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (!target) return res.status(404).json({ error: 'Utente non trovato' });

        // Protezione: super-admin non può resettare se stesso da qui (per evitare lockout strano)
        if (target.username === 'admin') {
            return res.status(403).json({ error: 'Per cambiare la password del super-admin usa il flusso di reset normale.' });
        }

        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
        const hash = await bcrypt.hash(newPassword, saltRounds);
        await db.runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);

        auditLog('dev_password_reset', req, { targetUserId: userId, targetUsername: target.username });
        res.json({ success: true, message: `Password di ${target.username} resettata` });
    } catch (error) {
        logger.error('Errore dev/reset-password', { error: error.message });
        res.status(500).json({ error: 'Errore server' });
    }
});

/**
 * DELETE /api/admin/dev/users/:id
 * Cancellazione utente con cascade (riusa la logica di /auth/users/:id ma da contesto dev autenticato).
 */
router.delete('/dev/users/:id', requireDevPanelEnabled, devApiLimiter, authenticateToken, requireSuperAdmin, requireDevSession, async (req, res) => {
    const userId = parseInt(req.params.id);
    if (!userId) return res.status(400).json({ error: 'ID non valido' });
    if (userId === req.user.id) return res.status(400).json({ error: 'Non puoi eliminare te stesso' });

    try {
        const target = await db.getAsync('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (!target) return res.status(404).json({ error: 'Utente non trovato' });
        if (target.username === 'admin') return res.status(403).json({ error: 'Il super-admin non può essere eliminato' });

        await db.withTransaction(async () => {
            // Cascade: lotti dell'utente + dati correlati
            await db.runAsync(`DELETE FROM activities WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [userId, target.username]);
            await db.runAsync(`DELETE FROM analyses WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [userId, target.username]);
            await db.runAsync(`DELETE FROM economic_records WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [userId, target.username]);
            await db.runAsync(`DELETE FROM lot_details WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ? OR owner_username = ?)`, [userId, target.username]);
            await db.runAsync(`DELETE FROM lots WHERE owner_id = ? OR owner_username = ?`, [userId, target.username]);
            await db.runAsync(`DELETE FROM users WHERE parent_id = ?`, [userId]);
            await db.runAsync(`DELETE FROM users WHERE id = ?`, [userId]);
        });

        auditLog('dev_user_deleted', req, { targetUserId: userId, targetUsername: target.username });
        res.json({ success: true, deleted: target.username });
    } catch (error) {
        logger.error('Errore dev/users delete', { error: error.message });
        res.status(500).json({ error: 'Errore server' });
    }
});

/**
 * GET /api/admin/dev/audit
 * Restituisce le ultime N righe del log audit dev (solo super-admin con dev session).
 */
router.get('/dev/audit', requireDevPanelEnabled, devApiLimiter, authenticateToken, requireSuperAdmin, requireDevSession, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    try {
        let lines = [];
        if (fs.existsSync(auditLogPath)) {
            const data = fs.readFileSync(auditLogPath, 'utf-8');
            lines = data.trim().split('\n').slice(-limit).reverse();
        }
        const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        auditLog('dev_audit_view', req, { rows: entries.length });
        res.json({ data: entries });
    } catch (error) {
        logger.error('Errore dev/audit', { error: error.message });
        res.status(500).json({ error: 'Errore server' });
    }
});

module.exports = router;
