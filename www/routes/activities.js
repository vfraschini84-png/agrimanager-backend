const express = require('express');
const db = require('../database');
const router = express.Router();
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware per autenticazione
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

// GET /api/activities/:lotId - Attività di un lotto
router.get('/:lotId', authenticateToken, async (req, res) => {
    try {
        const activities = await db.allAsync(
            'SELECT * FROM activities WHERE lot_id = ? ORDER BY date DESC',
            [req.params.lotId]
        );
        res.json({ data: activities });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/activities - Nuova attività
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { lot_id, date, kg, notes } = req.body;
        
        // Ottieni l'owner dal lotto (ereditato)
        const lot = await db.getAsync('SELECT owner_id, owner_username FROM lots WHERE id = ?', [lot_id]);
        if (!lot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        const result = await db.runAsync(
            `INSERT INTO activities (lot_id, date, kg, notes, owner_id, owner_username, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [lot_id, date, kg, notes, lot.owner_id, lot.owner_username, req.user.username]
        );
        
        res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/activities/:id - Elimina attività
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const activity = await db.getAsync('SELECT * FROM activities WHERE id = ?', [req.params.id]);
        if (!activity) {
            return res.status(404).json({ error: 'Attività non trovata' });
        }
        
        await db.runAsync('DELETE FROM activities WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
