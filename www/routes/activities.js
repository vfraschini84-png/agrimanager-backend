const express = require('express');
const db = require('../database');
const { requirePermission } = require('../middleware/rbac');
const { requireLotAccess, requireRecordAccess } = require('../middleware/tenantGuard');
const router = express.Router();
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware per autenticazione
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

/**
 * @swagger
 * /api/activities/{lotId}:
 *   get:
 *     tags:
 *       - Activities
 *     summary: Ottiene le attività di un lotto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: lotId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista attività paginata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Activity'
 *       401:
 *         description: Autenticazione richiesta
 *       500:
 *         description: Errore del server
 */
// GET /api/activities/:lotId - Attività di un lotto con paginazione
router.get('/:lotId', authenticateToken, requirePermission('activities:read'), async (req, res) => {
    try {
        const lotId = req.params.lotId;
        
        // ✅ PAGINAZIONE
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        if (page < 1 || limit < 1 || limit > 200) {
            return res.status(400).json({ 
                error: 'Parametri di paginazione non validi. page >= 1, 1 <= limit <= 200' 
            });
        }
        
        // Verifica permessi
        const lot = await db.getAsync('SELECT owner_id FROM lots WHERE id = ?', [lotId]);
        if (!lot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        if (req.user.username !== 'admin' && req.user.role !== 'admin') {
            const user = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [req.user.id]);
            const ownerId = user?.parent_id || req.user.id;
            
            if (lot.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Accesso negato' });
            }
        }
        
        // Query per il totale
        const countResult = await db.getAsync(
            'SELECT COUNT(*) as total FROM activities WHERE lot_id = ?',
            [lotId]
        );
        const totalItems = countResult.total;
        const totalPages = Math.ceil(totalItems / limit);
        
        // Query principale con paginazione
        const activities = await db.allAsync(
            `SELECT * FROM activities 
             WHERE lot_id = ? 
             ORDER BY date DESC, created_at DESC 
             LIMIT ? OFFSET ?`,
            [lotId, limit, offset]
        );
        
        res.json({
            data: activities,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: totalItems,
                totalPages: totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Errore GET activities:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/activities:
 *   post:
 *     tags:
 *       - Activities
 *     summary: Crea una nuova attività
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lot_id
 *               - date
 *             properties:
 *               lot_id:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date
 *               kg:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Attività creata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 id: { type: integer }
 *       404:
 *         description: Lotto non trovato
 *       500:
 *         description: Errore del server
 */
// POST /api/activities - Nuova attività
router.post('/',
    authenticateToken,
    requirePermission('activities:create'),
    requireLotAccess({ from: 'body', field: 'lot_id' }),
    async (req, res) => {
    try {
        const { lot_id, date, kg, notes } = req.body;
        const lot = req.tenantLot; // popolato da requireLotAccess (già verificato)
        
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

/**
 * @swagger
 * /api/activities/{id}:
 *   delete:
 *     tags:
 *       - Activities
 *     summary: Elimina un'attività
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Attività eliminata
 *       404:
 *         description: Attività non trovata
 *       500:
 *         description: Errore del server
 */
// DELETE /api/activities/:id - Elimina attività
router.delete('/:id',
    authenticateToken,
    requirePermission('activities:delete'),
    requireRecordAccess('activities'),
    async (req, res) => {
    try {
        await db.runAsync('DELETE FROM activities WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
