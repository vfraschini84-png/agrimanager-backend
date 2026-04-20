const express = require('express');
const db = require('../database');
const router = express.Router();
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token non fornito' });
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token non valido' });
    }
}

// GET /api/analyses/:lotId - Analisi di un lotto
router.get('/:lotId', authenticateToken, async (req, res) => {
    try {
        const analyses = await db.allAsync(
            'SELECT * FROM analyses WHERE lot_id = ? ORDER BY created_at DESC',
            [req.params.lotId]
        );
        res.json({ data: analyses });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/analyses - Nuova analisi
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { lot_id, year, filename, originalName, fileUrl, notes, fileSize } = req.body;
        
        const lot = await db.getAsync('SELECT owner_id, owner_username FROM lots WHERE id = ?', [lot_id]);
        if (!lot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        const result = await db.runAsync(
            `INSERT INTO analyses (lot_id, year, filename, original_name, file_url, notes, file_size, owner_id, owner_username, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lot_id, year, filename, originalName, fileUrl, notes, fileSize, lot.owner_id, lot.owner_username, req.user.username]
        );
        
        res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/analyses/:id - Elimina analisi
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await db.runAsync('DELETE FROM analyses WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
