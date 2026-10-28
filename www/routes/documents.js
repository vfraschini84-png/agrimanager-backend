// Documenti dei lotti (analisi, contratti, certificazioni...) su Object Storage
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const db = require('../database');
const logger = require('../logger');
const storage = require('../storage');
const { requirePermission } = require('../middleware/rbac');
const { requireLotAccess, assertLotAccess, isSuperAdmin } = require('../middleware/tenantGuard');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const CATEGORIES = ['analisi', 'contratto', 'certificazione', 'fattura', 'altro'];
const MIME_TYPES = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', txt: 'text/plain'
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE, files: 1 } });

function authenticateToken(req, res, next) {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: req.t ? req.t('errors.token_missing') : 'Token non fornito' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ error: req.t ? req.t('errors.token_invalid') : 'Token non valido' });
    }
}

function parseSingleFile(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File troppo grande (max 20 MB)' });
        return res.status(400).json({ error: err.message });
    });
}

const canDelete = (req, doc) => isSuperAdmin(req) || req.user.role === 'admin' || Number(doc.uploaded_by_id) === Number(req.user.id);

const toDto = (req, d) => ({
    id: d.id,
    lot_id: d.lot_id,
    category: d.category,
    year: d.year,
    original_name: d.original_name,
    content_type: d.content_type,
    size: d.size,
    notes: d.notes,
    uploaded_by: d.uploaded_by,
    created_at: d.created_at,
    can_delete: canDelete(req, d)
});

async function loadDocument(req, res) {
    const doc = await db.getAsync('SELECT * FROM lot_documents WHERE id = ? AND is_deleted = 0', [req.params.id]);
    if (!doc) {
        res.status(404).json({ error: 'Documento non trovato' });
        return null;
    }
    const check = await assertLotAccess(req, doc.lot_id);
    if (check.error) {
        res.status(check.error).json({ error: check.message });
        return null;
    }
    return doc;
}

// GET /api/documents/lot/:lotId?group=analisi|documenti
router.get('/lot/:lotId', authenticateToken, requirePermission('analyses:read'), requireLotAccess({ field: 'lotId' }), async (req, res) => {
    try {
        let filter = '';
        if (req.query.group === 'analisi') filter = "AND category = 'analisi'";
        else if (req.query.group === 'documenti') filter = "AND category != 'analisi'";
        const rows = await db.allAsync(
            `SELECT * FROM lot_documents WHERE lot_id = ? AND is_deleted = 0 ${filter} ORDER BY created_at DESC, id DESC`,
            [req.params.lotId]
        );
        res.json({ data: rows.map(d => toDto(req, d)) });
    } catch (error) {
        logger.error('Errore lista documenti', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// POST /api/documents/lot/:lotId  (multipart: file, category, year, notes)
router.post('/lot/:lotId', authenticateToken, requirePermission('analyses:create'), requireLotAccess({ field: 'lotId' }), parseSingleFile, async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Nessun file caricato' });

        const category = req.body.category || 'altro';
        if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Categoria non valida' });

        const year = req.body.year ? parseInt(req.body.year, 10) : null;
        if (category === 'analisi' && !year) return res.status(400).json({ error: 'Anno obbligatorio per le analisi' });

        const ext = path.extname(file.originalname || '').slice(1).toLowerCase();
        if (!MIME_TYPES[ext]) return res.status(400).json({ error: 'Tipo di file non supportato' });
        const contentType = MIME_TYPES[ext];

        const lot = req.tenantLot;
        const storagePath = `${storage.APP_NAME}/lots/${lot.id}/${crypto.randomUUID()}.${ext}`;
        const result = await storage.putObject(storagePath, file.buffer, contentType);

        const originalName = (file.originalname || `file.${ext}`).slice(0, 200);
        const notes = (req.body.notes || '').slice(0, 1000);
        const insert = await db.runAsync(
            `INSERT INTO lot_documents (lot_id, category, year, original_name, storage_path, content_type, size, notes, owner_id, uploaded_by_id, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lot.id, category, year, originalName, result.path || storagePath, contentType, file.size, notes, lot.owner_id, req.user.id, req.user.username]
        );
        const doc = await db.getAsync('SELECT * FROM lot_documents WHERE id = ?', [insert.id]);
        res.status(201).json({ success: true, data: toDto(req, doc) });
    } catch (error) {
        logger.error('Errore upload documento', { error: error.message });
        res.status(error.status === 439 ? 507 : 500).json({ error: 'Errore nel caricamento del file' });
    }
});

// GET /api/documents/:id/download
router.get('/:id/download', authenticateToken, requirePermission('analyses:read'), async (req, res) => {
    try {
        const doc = await loadDocument(req, res);
        if (!doc) return;
        const { data } = await storage.getObject(doc.storage_path);
        const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
        res.setHeader('Content-Type', doc.content_type);
        res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(data);
    } catch (error) {
        logger.error('Errore download documento', { error: error.message });
        res.status(error.status === 404 ? 404 : 500).json({ error: 'Errore nel download del file' });
    }
});

// DELETE /api/documents/:id  (solo chi l'ha caricato o amministratori)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const doc = await loadDocument(req, res);
        if (!doc) return;
        if (!canDelete(req, doc)) return res.status(403).json({ error: 'Solo chi ha caricato il file o un amministratore può eliminarlo' });
        await db.runAsync('UPDATE lot_documents SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [doc.id]);
        res.json({ success: true });
    } catch (error) {
        logger.error('Errore eliminazione documento', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
