const express = require('express');
const db = require('../database');
const router = express.Router();
const JWT_SECRET = 'agrimanager_secret_key_change_this_in_production';

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
        // ⚠️ IMPORTANTE: Usa gli stessi nomi che arrivano dal frontend (snake_case)
        const { 
            lot_id, 
            stagione_agricola,      // ← snake_case
            data_acquisto_vendita,   // ← snake_case
            metodo_calcolo,          // ← snake_case
            prezzo_kg,               // ← snake_case
            prezzo_totale,           // ← snake_case
            totale_kg,               // ← snake_case
            ricavi_totali,           // ← snake_case
            costo_mezzi_tecnici,     // ← snake_case
            costo_personale,         // ← snake_case
            beni_durevoli,           // ← snake_case
            costi_totali,            // ← snake_case
            bilancio                 // ← snake_case
        } = req.body;
        
        console.log('📥 Dati ricevuti:', {
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
            costi_totali,
            bilancio
        });
        
        // Validazione base
        if (!lot_id) {
            return res.status(400).json({ error: 'lot_id è obbligatorio' });
        }
        
        // Ottieni il lotto per ereditare owner_id
        const lot = await db.getAsync('SELECT owner_id, owner_username FROM lots WHERE id = ?', [lot_id]);
        if (!lot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        const result = await db.runAsync(
            `INSERT INTO economic_records (
                lot_id, stagione_agricola, data_acquisto_vendita, metodo_calcolo,
                prezzo_kg, prezzo_totale, totale_kg, ricavi_totali,
                costo_mezzi_tecnici, costo_personale, beni_durevoli, costi_totali, bilancio,
                owner_id, owner_username, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                lot.owner_id, 
                lot.owner_username, 
                req.user.username,
                new Date().toISOString()
            ]
        );
        
        console.log('✅ Record inserito con ID:', result.id);
        
        // Restituisci il record appena creato
        const newRecord = await db.getAsync('SELECT * FROM economic_records WHERE id = ?', [result.id]);
        
        res.status(201).json({ success: true, id: result.id, data: newRecord });
    } catch (error) {
        console.error('❌ Errore POST economic:', error);
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

module.exports = router;