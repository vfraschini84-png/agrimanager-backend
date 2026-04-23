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

// ==================== ROUTE SPECIFICHE (PRIMA!) ====================

// GET /api/economic/record/:id - Recupera UNA singola registrazione (per modifica)
router.get('/record/:id', authenticateToken, async (req, res) => {
    try {
        const record = await db.getAsync(
            'SELECT * FROM economic_records WHERE id = ?',
            [req.params.id]
        );
        
        if (!record) {
            return res.status(404).json({ error: 'Registrazione non trovata' });
        }
        
        const lot = await db.getAsync('SELECT owner_id FROM lots WHERE id = ?', [record.lot_id]);
        
        if (req.user.username !== 'admin' && req.user.role !== 'admin') {
            const user = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [req.user.id]);
            const ownerId = user?.parent_id || req.user.id;
            
            if (lot.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Accesso negato' });
            }
        }
        
        if (record.beni_durevoli) {
            try {
                record.beni_durevoli = JSON.parse(record.beni_durevoli);
            } catch (e) {
                record.beni_durevoli = [];
            }
        }
        
        res.json({ data: record });
    } catch (error) {
        console.error('Errore GET record economico:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/economic/:id - Aggiorna registrazione economica
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
    stagione_agricola, data_acquisto_vendita, metodo_calcolo, 
    prezzo_kg, prezzo_totale, totale_kg, ricavi_totali, 
    costo_mezzi_tecnici, costo_personale, beni_durevoli, 
    costi_totali, bilancio,
    // ✅ NUOVI CAMPI
    anni_ammortamento,
    quota_ammortamento,
    ammortamento_residuo
} = req.body;
        
        // ✅ VALIDAZIONE
        const errors = [];
        if (totale_kg !== undefined && totale_kg < 0) errors.push('Kg totali non possono essere negativi');
        if (prezzo_kg !== undefined && prezzo_kg < 0) errors.push('Prezzo/kg non può essere negativo');
        if (prezzo_totale !== undefined && prezzo_totale < 0) errors.push('Prezzo totale non può essere negativo');
        if (costo_mezzi_tecnici !== undefined && costo_mezzi_tecnici < 0) errors.push('Costo mezzi tecnici non può essere negativo');
        if (costo_personale !== undefined && costo_personale < 0) errors.push('Costo personale non può essere negativo');
        
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Dati non validi', details: errors });
        }
        
        // Verifica che la registrazione esista
        const existing = await db.getAsync(
            'SELECT * FROM economic_records WHERE id = ?',
            [id]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Registrazione non trovata' });
        }
        
        // Verifica permessi multi-tenant
        const lot = await db.getAsync('SELECT owner_id FROM lots WHERE id = ?', [existing.lot_id]);
        
        if (req.user.username !== 'admin' && req.user.role !== 'admin') {
            const user = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [req.user.id]);
            const ownerId = user?.parent_id || req.user.id;
            
            if (lot.owner_id !== ownerId) {
                return res.status(403).json({ error: 'Accesso negato' });
            }
        }
        
        // Aggiorna la registrazione
        await db.runAsync(
    `UPDATE economic_records SET 
        stagione_agricola = ?, 
        data_acquisto_vendita = ?, 
        metodo_calcolo = ?, 
        prezzo_kg = ?, 
        prezzo_totale = ?, 
        totale_kg = ?, 
        ricavi_totali = ?, 
        costo_mezzi_tecnici = ?, 
        costo_personale = ?, 
        beni_durevoli = ?, 
        costi_totali = ?, 
        bilancio = ?,
        anni_ammortamento = ?,
        quota_ammortamento = ?,
        ammortamento_residuo = ?
     WHERE id = ?`,
    [
        stagione_agricola || '', 
        data_acquisto_vendita || '', 
        metodo_calcolo || '',
        prezzo_kg || 0, 
        prezzo_totale || 0, 
        totale_kg || 0, 
        ricavi_totali || 0,
        costo_mezzi_tecnici || 0, 
        costo_personale || 0, 
        beni_durevoli ? JSON.stringify(beni_durevoli) : '[]', 
        costi_totali || 0, 
        bilancio || 0,
        // ✅ NUOVI VALORI
        anni_ammortamento || 1,
        quota_ammortamento || 0,
        ammortamento_residuo || 0,
        id
    ]
);
        
        const updated = await db.getAsync('SELECT * FROM economic_records WHERE id = ?', [id]);
        
        if (updated.beni_durevoli) {
            try {
                updated.beni_durevoli = JSON.parse(updated.beni_durevoli);
            } catch (e) {
                updated.beni_durevoli = [];
            }
        }
        
        console.log('✅ Record aggiornato con ID:', id);
        res.json({ success: true, message: 'Registrazione aggiornata', data: updated });
    } catch (error) {
        console.error('Errore PUT economic:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/economic/:id - Elimina record economico
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await db.runAsync('DELETE FROM economic_records WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Record non trovato' });
        }
        console.log('✅ Record eliminato con ID:', req.params.id);
        res.json({ success: true, deleted_id: req.params.id });
    } catch (error) {
        console.error('Errore DELETE economic:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROUTE GENERICHE (DOPO) ====================

// GET /api/economic/:lotId - Dati economici di un lotto
router.get('/:lotId', authenticateToken, async (req, res) => {
    try {
        const records = await db.allAsync(
            'SELECT * FROM economic_records WHERE lot_id = ? ORDER BY created_at DESC',
            [req.params.lotId]
        );
        res.json({ data: records });
    } catch (error) {
        console.error('Errore GET economic:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/economic - Nuovo record economico
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { 
            lot_id, 
            stagione_agricola,
            data_acquisto_vendita,
            metodo_calcolo,
            prezzo_kg,
            prezzo_totale,
            totale_kg,
            ricavi_totali,
            costo_mezzi_tecnici,
            costo_personale,
            beni_durevoli,
            costi_totali,
            bilancio,
            // ✅ NUOVI CAMPI
    anni_ammortamento,
    quota_ammortamento,
    ammortamento_residuo
        } = req.body;
        
        console.log('📥 Dati ricevuti:', { lot_id, stagione_agricola });
        
        if (!lot_id) {
            return res.status(400).json({ error: 'lot_id è obbligatorio' });
        }
        
        const lot = await db.getAsync('SELECT owner_id, owner_username FROM lots WHERE id = ?', [lot_id]);
        if (!lot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        const result = await db.runAsync(
    `INSERT INTO economic_records (
        lot_id, stagione_agricola, data_acquisto_vendita, metodo_calcolo,
        prezzo_kg, prezzo_totale, totale_kg, ricavi_totali,
        costo_mezzi_tecnici, costo_personale, beni_durevoli, costi_totali, bilancio,
        anni_ammortamento, quota_ammortamento, ammortamento_residuo,
        owner_id, owner_username, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        lot_id, 
        stagione_agricola || '', 
        data_acquisto_vendita || '', 
        metodo_calcolo || '',
        prezzo_kg || 0, 
        prezzo_totale || 0, 
        totale_kg || 0, 
        ricavi_totali || 0,
        costo_mezzi_tecnici || 0, 
        costo_personale || 0, 
        beni_durevoli ? JSON.stringify(beni_durevoli) : '[]', 
        costi_totali || 0, 
        bilancio || 0,
        // ✅ NUOVI VALORI
        anni_ammortamento || 1,
        quota_ammortamento || 0,
        ammortamento_residuo || 0,
        lot.owner_id, 
        lot.owner_username, 
        req.user.username,
        new Date().toISOString()
    ]
);
        
        console.log('✅ Record inserito con ID:', result.id);
        
        const newRecord = await db.getAsync('SELECT * FROM economic_records WHERE id = ?', [result.id]);
        
        res.status(201).json({ success: true, id: result.id, data: newRecord });
    } catch (error) {
        console.error('❌ Errore POST economic:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;