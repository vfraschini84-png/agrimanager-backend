// routes/users.js — user preferences (language, ecc.)
const express = require('express');
const db = require('../database');
const router = express.Router();
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: req.t ? req.t('errors.token_missing') : 'Token non fornito' });
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: req.t ? req.t('errors.token_invalid') : 'Token non valido' });
    }
}

const SUPPORTED_LANGS = ['it', 'en', 'es'];

// GET /api/users/me/language — restituisce la lingua salvata dell'utente autenticato
router.get('/me/language', authenticateToken, async (req, res) => {
    try {
        const row = await db.getAsync('SELECT language FROM users WHERE id = ?', [req.user.id]);
        res.json({ language: (row && row.language) || 'it' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/users/language — persiste la lingua scelta dall'utente
// Body: { language: 'it' | 'en' | 'es' }
router.put('/language', authenticateToken, async (req, res) => {
    try {
        const lang = String(req.body.language || '').trim();
        if (!SUPPORTED_LANGS.includes(lang)) {
            return res.status(400).json({ error: req.t ? req.t('errors.language_unsupported') : `Lingua non supportata. Ammesse: ${SUPPORTED_LANGS.join(', ')}` });
        }
        await db.runAsync('UPDATE users SET language = ? WHERE id = ?', [lang, req.user.id]);
        res.json({ success: true, language: lang });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
