// routes/companies.js — CRUD aziende (gerarchia: Azienda → Lotti)
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { requirePermission } = require('../middleware/rbac');
const db = require('../database');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token non fornito' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token non valido' });
    }
}

// Helper RBAC: restituisce { ownerIds, currentUsername } per filtrare per tenant
async function getTenantScope(req) {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    const currentUsername = req.user.username;
    const userRow = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [currentUserId]);
    const parentId = userRow?.parent_id || null;
    
    if (currentUsername === 'admin') return { ownerIds: null, currentUsername }; // null = vede tutti
    if (currentUserRole === 'admin') {
        const subs = await db.allAsync('SELECT id FROM users WHERE parent_id = ?', [currentUserId]);
        return { ownerIds: [currentUserId, ...subs.map(s => s.id)], currentUsername };
    }
    if (parentId) return { ownerIds: [parentId], currentUsername };
    return { ownerIds: [currentUserId], currentUsername };
}

function buildWhere(ownerIds) {
    if (!ownerIds) return { where: '', params: [] };
    const ph = ownerIds.map(() => '?').join(',');
    return { where: `WHERE owner_id IN (${ph})`, params: ownerIds };
}

// ==================== LISTA AZIENDE (con conteggio lotti) ====================
router.get('/', authenticateToken, requirePermission('lots:read'), async (req, res) => {
    try {
        const { ownerIds } = await getTenantScope(req);
        const { where, params } = buildWhere(ownerIds);
        const rows = await db.allAsync(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM lots WHERE company_id = c.id) AS lots_count
             FROM companies c
             ${where}
             ORDER BY c.name COLLATE NOCASE ASC`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        logger.error('GET /companies', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// ==================== DETTAGLIO AZIENDA + LISTA LOTTI ====================
router.get('/:id', authenticateToken, requirePermission('lots:read'), async (req, res) => {
    try {
        const { ownerIds } = await getTenantScope(req);
        const { where, params } = buildWhere(ownerIds);
        const company = await db.getAsync(
            `SELECT * FROM companies ${where} ${where ? 'AND' : 'WHERE'} id = ?`,
            [...params, req.params.id]
        );
        if (!company) return res.status(404).json({ error: 'Azienda non trovata' });
        const lots = await db.allAsync(
            `SELECT * FROM lots WHERE company_id = ? ORDER BY created_at DESC`,
            [company.id]
        );
        res.json({ success: true, data: { ...company, lots } });
    } catch (err) {
        logger.error('GET /companies/:id', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// ==================== CREATE AZIENDA ====================
router.post('/', authenticateToken, requirePermission('lots:create'), async (req, res) => {
    try {
        const { name, sectors, address } = req.body || {};
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nome azienda obbligatorio' });
        }
        const currentUserId = req.user.id;
        const currentUsername = req.user.username;
        const userRow = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [currentUserId]);
        const ownerId = userRow?.parent_id || currentUserId;
        const ownerRow = await db.getAsync('SELECT username FROM users WHERE id = ?', [ownerId]);
        
        // Dedupe per owner_id + name (case-insensitive)
        const existing = await db.getAsync(
            `SELECT id FROM companies WHERE owner_id = ? AND LOWER(name) = LOWER(?)`,
            [ownerId, name.trim()]
        );
        if (existing) {
            return res.status(409).json({ error: 'Esiste già un\'azienda con questo nome', data: { id: existing.id } });
        }
        const sectorsStr = Array.isArray(sectors) ? sectors.join(',') : (sectors || '');
        const result = await db.runAsync(
            `INSERT INTO companies (name, sectors, address, owner_id, owner_username, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name.trim(), sectorsStr, (address || '').trim(), ownerId, ownerRow?.username || null, currentUsername]
        );
        const created = await db.getAsync(`SELECT * FROM companies WHERE id = ?`, [result.id]);
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        logger.error('POST /companies', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// ==================== UPDATE AZIENDA ====================
router.put('/:id', authenticateToken, requirePermission('lots:update'), async (req, res) => {
    try {
        const { ownerIds } = await getTenantScope(req);
        const { where, params } = buildWhere(ownerIds);
        const company = await db.getAsync(
            `SELECT * FROM companies ${where} ${where ? 'AND' : 'WHERE'} id = ?`,
            [...params, req.params.id]
        );
        if (!company) return res.status(404).json({ error: 'Azienda non trovata' });
        const { name, sectors, address } = req.body || {};
        const sectorsStr = Array.isArray(sectors) ? sectors.join(',') : (sectors ?? company.sectors);
        await db.runAsync(
            `UPDATE companies SET name = ?, sectors = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [(name || company.name).trim(), sectorsStr, (address ?? company.address) || '', company.id]
        );
        // Aggiorna company_name dei lotti (snapshot)
        if (name && name.trim() !== company.name) {
            await db.runAsync(`UPDATE lots SET company_name = ? WHERE company_id = ?`, [name.trim(), company.id]);
        }
        const updated = await db.getAsync(`SELECT * FROM companies WHERE id = ?`, [company.id]);
        res.json({ success: true, data: updated });
    } catch (err) {
        logger.error('PUT /companies/:id', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// ==================== DELETE AZIENDA (solo se senza lotti) ====================
router.delete('/:id', authenticateToken, requirePermission('lots:delete'), async (req, res) => {
    try {
        const { ownerIds } = await getTenantScope(req);
        const { where, params } = buildWhere(ownerIds);
        const company = await db.getAsync(
            `SELECT * FROM companies ${where} ${where ? 'AND' : 'WHERE'} id = ?`,
            [...params, req.params.id]
        );
        if (!company) return res.status(404).json({ error: 'Azienda non trovata' });
        const lotsCount = await db.getAsync(`SELECT COUNT(*) AS n FROM lots WHERE company_id = ?`, [company.id]);
        if (lotsCount.n > 0) {
            return res.status(409).json({ 
                error: `Impossibile eliminare: l'azienda ha ${lotsCount.n} lotti associati. Eliminare prima i lotti.`
            });
        }
        await db.runAsync(`DELETE FROM companies WHERE id = ?`, [company.id]);
        res.json({ success: true, message: 'Azienda eliminata' });
    } catch (err) {
        logger.error('DELETE /companies/:id', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
