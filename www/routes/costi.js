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

// ==================== TARIFFE MANODOPERA ====================

// GET /api/costi/tariffe/:stagione - Recupera tariffe per stagione
router.get('/tariffe/:stagione', authenticateToken, async (req, res) => {
    try {
        let tariffa = await db.getAsync(
            'SELECT * FROM tariffe_manodopera WHERE stagione_agricola = ? AND owner_id = ?',
            [req.params.stagione, req.user.id]
        );
        
        if (!tariffa) {
            // Crea tariffa default
            await db.runAsync(
                `INSERT INTO tariffe_manodopera (stagione_agricola, costo_orario_standard, costo_orario_specializzato, owner_id, owner_username)
                 VALUES (?, 15.00, 22.00, ?, ?)`,
                [req.params.stagione, req.user.id, req.user.username]
            );
            tariffa = {
                stagione_agricola: req.params.stagione,
                costo_orario_standard: 15.00,
                costo_orario_specializzato: 22.00
            };
        }
        
        res.json({ data: tariffa });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/costi/tariffe/:stagione - Aggiorna tariffe
router.put('/tariffe/:stagione', authenticateToken, async (req, res) => {
    try {
        const { costo_orario_standard, costo_orario_specializzato } = req.body;
        
        await db.runAsync(
            `UPDATE tariffe_manodopera 
             SET costo_orario_standard = ?, costo_orario_specializzato = ?
             WHERE stagione_agricola = ? AND owner_id = ?`,
            [costo_orario_standard, costo_orario_specializzato, req.params.stagione, req.user.id]
        );
        
        res.json({ success: true, message: 'Tariffe aggiornate' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ATTIVITÀ PREDEFINITE ====================

// GET /api/costi/attivita - Lista attività (globali + personali + admin)
router.get('/attivita', authenticateToken, async (req, res) => {
    try {
        // Trova il parent_id dell'utente
        let parentId = req.user.id;
        if (req.user.role !== 'admin') {
            const user = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [req.user.id]);
            if (user?.parent_id) parentId = user.parent_id;
        }
        
        const attivita = await db.allAsync(
            `SELECT DISTINCT nome FROM attivita_predefinite 
             WHERE owner_id IN (1, ?, ?) 
             ORDER BY nome`,
            [req.user.id, parentId]
        );
        res.json({ data: attivita });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/costi/attivita
router.post('/attivita', authenticateToken, async (req, res) => {
    try {
        const { nome, categoria } = req.body;
        
        // Verifica se esiste già per questo utente
        const esiste = await db.getAsync(
            'SELECT id FROM attivita_predefinite WHERE nome = ? AND owner_id = ?',
            [nome, req.user.id]
        );
        
        if (esiste) {
            return res.json({ success: true, id: esiste.id, message: 'Già esistente' });
        }
        
        const result = await db.runAsync(
            `INSERT INTO attivita_predefinite (nome, categoria, owner_id, owner_username)
             VALUES (?, ?, ?, ?)`,
            [nome, categoria || 'personalizzata', req.user.id, req.user.username]
        );
        
        res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== COSTI PERSONALE ====================

// GET /api/costi/personale/:lotId/:stagione - Costi personale per lotto e stagione
router.get('/personale/:lotId/:stagione', authenticateToken, async (req, res) => {
    try {
        const { lotId, stagione } = req.params;
        
        // ✅ Verifica che il lotto appartenga all'utente
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
        
        const records = await db.allAsync(
            `SELECT * FROM costi_personale WHERE lot_id = ? AND stagione_agricola = ? ORDER BY data_attivita DESC`,
            [lotId, stagione]
        );
        const totaleStagione = records.reduce((sum, r) => sum + (r.costo_totale || 0), 0);
        res.json({ data: records, totale: totaleStagione });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/costi/personale - Registra costo personale
router.post('/personale', authenticateToken, async (req, res) => {
    try {
        const { lot_id, stagione_agricola, data_attivita, numero_operatori, 
                qualifica, ore_lavorate, attivita, note } = req.body;
        
        // Recupera tariffa oraria
        const tariffa = await db.getAsync(
            'SELECT * FROM tariffe_manodopera WHERE stagione_agricola = ? AND owner_id = ?',
            [stagione_agricola, req.user.id]
        );
        
        const costoOrario = qualifica === 'specializzato' 
            ? (tariffa?.costo_orario_specializzato || 22.00)
            : (tariffa?.costo_orario_standard || 15.00);
        
        const costoTotale = numero_operatori * ore_lavorate * costoOrario;
        
        const lot = await db.getAsync('SELECT owner_id, owner_username FROM lots WHERE id = ?', [lot_id]);
        
        const result = await db.runAsync(
            `INSERT INTO costi_personale 
             (lot_id, stagione_agricola, data_attivita, numero_operatori, qualifica, 
              ore_lavorate, attivita, costo_orario, costo_totale, note,
              owner_id, owner_username, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lot_id, stagione_agricola, data_attivita, numero_operatori, qualifica,
             ore_lavorate, attivita, costoOrario, costoTotale, note,
             lot.owner_id, lot.owner_username, req.user.username]
        );
        
        res.status(201).json({ success: true, id: result.id, costo_totale: costoTotale });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/costi/personale/:id - Elimina costo personale
router.delete('/personale/:id', authenticateToken, async (req, res) => {
    try {
        await db.runAsync('DELETE FROM costi_personale WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/costi/personale/:id - Modifica costo personale
router.put('/personale/:id', authenticateToken, async (req, res) => {
    try {
        const { numero_operatori, qualifica, ore_lavorate, attivita, note } = req.body;
        const record = await db.getAsync('SELECT * FROM costi_personale WHERE id = ?', [req.params.id]);
        
        if (!record) return res.status(404).json({ error: 'Record non trovato' });
        
        const tariffa = await db.getAsync(
            'SELECT * FROM tariffe_manodopera WHERE stagione_agricola = ? AND owner_id = ?',
            [record.stagione_agricola, req.user.id]
        );
        
        const costoOrario = qualifica === 'specializzato' 
            ? (tariffa?.costo_orario_specializzato || 22.00)
            : (tariffa?.costo_orario_standard || 15.00);
        
        const costoTotale = (numero_operatori || record.numero_operatori) * 
                           (ore_lavorate || record.ore_lavorate) * costoOrario;
        
        await db.runAsync(
            `UPDATE costi_personale SET 
             numero_operatori = ?, qualifica = ?, ore_lavorate = ?, 
             attivita = ?, costo_orario = ?, costo_totale = ?, note = ?
             WHERE id = ?`,
            [numero_operatori || record.numero_operatori,
             qualifica || record.qualifica,
             ore_lavorate || record.ore_lavorate,
             attivita || record.attivita,
             costoOrario, costoTotale,
             note || record.note,
             req.params.id]
        );
        
        res.json({ success: true, costo_totale: costoTotale });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== COSTI MEZZI TECNICI ====================

// GET /api/costi/mezzi/:lotId/:stagione
router.get('/mezzi/:lotId/:stagione', authenticateToken, async (req, res) => {
    try {
        // ✅ Verifica che il lotto appartenga all'utente
        const lot = await db.getAsync('SELECT owner_id FROM lots WHERE id = ?', [req.params.lotId]);
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

        const records = await db.allAsync(
            `SELECT * FROM costi_mezzi_tecnici 
             WHERE lot_id = ? AND stagione_agricola = ?
             ORDER BY data_registrazione DESC`,
            [req.params.lotId, req.params.stagione]
        );
        const totale = records.reduce((sum, r) => sum + (r.importo || 0), 0);
        res.json({ data: records, totale });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/costi/mezzi
router.post('/mezzi', authenticateToken, async (req, res) => {
    try {
        const { lot_id, stagione_agricola, data_registrazione, descrizione, importo, categoria } = req.body;
        const lot = await db.getAsync('SELECT owner_id, owner_username FROM lots WHERE id = ?', [lot_id]);
        
        const result = await db.runAsync(
            `INSERT INTO costi_mezzi_tecnici 
             (lot_id, stagione_agricola, data_registrazione, descrizione, importo, categoria,
              owner_id, owner_username, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lot_id, stagione_agricola, data_registrazione, descrizione, importo, categoria || 'fitofarmaci',
             lot.owner_id, lot.owner_username, req.user.username]
        );
        
        res.status(201).json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/costi/mezzi/:id
router.delete('/mezzi/:id', authenticateToken, async (req, res) => {
    try {
        await db.runAsync('DELETE FROM costi_mezzi_tecnici WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;