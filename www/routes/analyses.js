const express = require('express');
const db = require('../database');
const { requirePermission } = require('../middleware/rbac');
const { requireLotAccess, requireRecordAccess } = require('../middleware/tenantGuard');
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

/**
 * @swagger
 * /api/analyses/{lotId}:
 *   get:
 *     tags:
 *       - Analyses
 *     summary: Ottiene le analisi di un lotto
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
 *     responses:
 *       200:
 *         description: Lista analisi paginata
 *       401:
 *         description: Autenticazione richiesta
 *       500:
 *         description: Errore del server
 */
// GET /api/analyses/:lotId - Analisi di un lotto con paginazione
router.get('/:lotId', authenticateToken, requirePermission('analyses:read'), async (req, res) => {
    try {
        const lotId = req.params.lotId;
        
        // ✅ PAGINAZIONE
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        if (page < 1 || limit < 1 || limit > 100) {
            return res.status(400).json({ 
                error: 'Parametri di paginazione non validi. page >= 1, 1 <= limit <= 100' 
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
            'SELECT COUNT(*) as total FROM analyses WHERE lot_id = ?',
            [lotId]
        );
        const totalItems = countResult.total;
        const totalPages = Math.ceil(totalItems / limit);
        
        // Query principale con paginazione
        const analyses = await db.allAsync(
            `SELECT * FROM analyses 
             WHERE lot_id = ? 
             ORDER BY year DESC, created_at DESC 
             LIMIT ? OFFSET ?`,
            [lotId, limit, offset]
        );
        
        res.json({
            data: analyses,
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
        console.error('Errore GET analyses:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/analyses:
 *   post:
 *     tags:
 *       - Analyses
 *     summary: Crea una nuova analisi
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
 *             properties:
 *               lot_id: { type: integer }
 *               year: { type: integer }
 *               filename: { type: string }
 *               fileUrl: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Analisi creata
 *       404:
 *         description: Lotto non trovato
 *       500:
 *         description: Errore del server
 */
// POST /api/analyses - Nuova analisi
router.post('/',
    authenticateToken,
    requirePermission('analyses:create'),
    requireLotAccess({ from: 'body', field: 'lot_id' }),
    async (req, res) => {
    try {
        const { lot_id, year, filename, originalName, fileUrl, notes, fileSize } = req.body;
        const lot = req.tenantLot;
        
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

/**
 * @swagger
 * /api/analyses/{id}:
 *   delete:
 *     tags:
 *       - Analyses
 *     summary: Elimina un'analisi
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
 *         description: Analisi eliminata
 *       500:
 *         description: Errore del server
 */
// DELETE /api/analyses/:id - Elimina analisi
router.delete('/:id',
    authenticateToken,
    requirePermission('analyses:delete'),
    requireRecordAccess('analyses'),
    async (req, res) => {
    try {
        await db.runAsync('DELETE FROM analyses WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
