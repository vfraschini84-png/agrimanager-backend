const express = require('express');
const db = require('../database');
const router = express.Router();
// Secret per JWT (stessa di auth.js)
const JWT_SECRET = 'agrimanager_secret_key_change_this_in_production';

// Validazione avanzata URL Google Maps con misure di sicurezza
const isValidGoogleMapsUrl = (url) => {
    // ✅ Controllo sicuro per null/undefined
    if (!url || typeof url !== 'string') return false;
    
    const lowerUrl = url.toLowerCase().trim();
// ✅ Se la stringa è vuota dopo il trim
    if (lowerUrl.length === 0) return false;
    
    // 1. Verifica che sia un URL valido
    try {
        new URL(lowerUrl);
    } catch {
        return false;
    }
    
    // 2. Verifica dominio Google genuino (protezione da phishing)
    const isGoogleDomain = lowerUrl.includes('google.') || 
                          lowerUrl.includes('goo.gl') ||
                          lowerUrl.includes('google.com') ||
                          lowerUrl.includes('google.it') ||
                          lowerUrl.includes('google.fr') ||
                          lowerUrl.includes('google.de') ||
                          lowerUrl.includes('google.es');
    
    if (!isGoogleDomain) return false;
    
    // 3. Verifica che sia specificamente un link Maps (protezione da URL ingannevoli)
    const mapsPatterns = [
        '/maps',
        'maps.',
        'maps/',
        'maps?',
        'maps%',
        'map=',
        'place/',
        'search/',
        'dir/',
        '@'
    ];
    
    const isMapsUrl = mapsPatterns.some(pattern => lowerUrl.includes(pattern));
    if (!isMapsUrl) return false;
    
    // 4. Protezione da URL malevoli o ingannevoli
    const maliciousPatterns = [
        'javascript:',
        'data:',
        'vbscript:',
        'expression(',
        'onload=',
        'onerror=',
        'alert(',
        'eval(',
        'document.cookie',
        'window.location',
        '%0d', // CR injection
        '%0a', // LF injection
        '%00', // Null byte
        '../', // Directory traversal
        '\\x'  // Hex encoding
    ];
    
    const isMalicious = maliciousPatterns.some(pattern => lowerUrl.includes(pattern));
    if (isMalicious) return false;
    
    // 5. Verifica formati specifici Google Maps
    const validFormats = [
        // Formati standard
        /https?:\/\/(www\.)?google\.[a-z]{2,3}\/maps\/place\/.+/i,
        /https?:\/\/(www\.)?google\.[a-z]{2,3}\/maps\/search\/.+/i,
        /https?:\/\/(www\.)?google\.[a-z]{2,3}\/maps\/dir\/.+/i,
        /https?:\/\/(www\.)?google\.[a-z]{2,3}\/maps\/@.+/i,
        /https?:\/\/(www\.)?maps\.google\.[a-z]{2,3}\/.+/i,
        
        // Formati con coordinate
        /https?:\/\/(www\.)?google\.[a-z]{2,3}\/maps\?q=-?\d+\.\d+,-?\d+\.\d+/i,
        /https?:\/\/(www\.)?google\.[a-z]{2,3}\/maps\/\?q=-?\d+\.\d+,-?\d+\.\d+/i,
        
        // Short links
        /https?:\/\/(www\.)?goo\.gl\/maps\/[a-z0-9]+/i,
        /https?:\/\/(www\.)?maps\.app\.goo\.gl\/[a-z0-9]+/i,
        
        // Formati internazionali
        /https?:\/\/(www\.)?google\.[a-z]{2,3}\/maps\/place\/.+/i,
        /https?:\/\/(www\.)?google\.[a-z]{2,3}\/maps\/search\/.+/i
    ];
    
    return validFormats.some(pattern => pattern.test(lowerUrl));
};

// ✅ VERSIONE CORRETTA - con validazione sicura
const validateLot = (lotData, isUpdate = false) => {
    const errors = [];
    
    // ✅ Validazione sicura - usa sempre optional chaining e default values
    if (!isUpdate || lotData.company_name !== undefined) {
        const companyName = (lotData.company_name || '').trim();
        if (!companyName || companyName.length < 2) {
            errors.push('Nome azienda deve avere almeno 2 caratteri');
        }
    }
    
    if (!isUpdate || lotData.location !== undefined) {
        const location = (lotData.location || '').trim();
        if (!location || location.length < 2) {
            errors.push('Luogo deve avere almeno 2 caratteri');
        }
    }
    
    if (!isUpdate || lotData.gps_coordinates !== undefined) {
    const gps = (lotData.gps_coordinates || '').trim();
    // Se viene inserito un valore GPS, deve essere valido, ma non è obbligatorio
    if (gps && !isValidGoogleMapsUrl(gps)) {
        errors.push('Coordinate GPS devono essere un link Google Maps valido. Formati accettati: google.com/maps, maps.google.com, goo.gl/maps, maps.app.goo.gl');
    }
}
    
    if (!isUpdate || lotData.product_type !== undefined) {
        const validProductTypes = ['frutta', 'verdura', 'cereali', 'vino', 'olio', 'latte', 'carne'];
        const productType = (lotData.product_type || '').toLowerCase();
        if (!productType || !validProductTypes.includes(productType)) {
            errors.push(`Tipologia prodotto deve essere uno di: ${validProductTypes.join(', ')}`);
        }
    }
    
    // VARIETÀ NON PIÙ OBBLIGATORIA - RIMOSSA LA VALIDAZIONE OBBLIGATORIA
    if (!isUpdate || lotData.variety !== undefined) {
        const variety = (lotData.variety || '').trim();
        // Se viene inserita una varietà, deve avere almeno 2 caratteri, ma non è obbligatoria
        if (variety && variety.length < 2) {
            errors.push('Varietà deve avere almeno 2 caratteri se inserita');
        }
    }
    
    // Validazione campo product_category (opzionale)
    if (!isUpdate || lotData.product_category !== undefined) {
        const productCategory = (lotData.product_category || '').trim();
        // Se viene inserito un prodotto, deve avere almeno 2 caratteri, ma non è obbligatorio
        if (productCategory && productCategory.length < 2) {
            errors.push('Prodotto deve avere almeno 2 caratteri se inserito');
        }
    }
    
    // Validazione campi opzionali - ✅ VERSIONE SICURA
    if (lotData.field_lot !== undefined && lotData.field_lot !== null) {
        const fieldLot = String(lotData.field_lot || '');
        if (fieldLot.length > 100) {
            errors.push('Lotto campo non può superare 100 caratteri');
        }
    }
    
    if (lotData.field_size !== undefined && lotData.field_size !== null) {
        const fieldSize = parseFloat(lotData.field_size);
        if (isNaN(fieldSize) || fieldSize < 0) {
            errors.push('Superficie deve essere un numero positivo');
        }
        if (fieldSize > 10000) {
            errors.push('Superficie non può superare 10.000 ettari');
        }
    }
    
    // Validazione campi opzionali per update
    if (isUpdate && lotData.cost_per_kg !== undefined && lotData.cost_per_kg !== null) {
        const cost = parseFloat(lotData.cost_per_kg);
        if (cost < 0) {
            errors.push('Costo per kg non può essere negativo');
        }
    }
    
    if (isUpdate && lotData.estimated_kg !== undefined && lotData.estimated_kg !== null) {
        const estimated = parseFloat(lotData.estimated_kg);
        if (estimated < 0) {
            errors.push('Kg stimati non possono essere negativi');
        }
    }
    
    if (isUpdate && lotData.harvested_kg !== undefined && lotData.harvested_kg !== null) {
        const harvested = parseFloat(lotData.harvested_kg);
        if (harvested < 0) {
            errors.push('Kg raccolti non possono essere negativi');
        }
    }
    
    return errors;
};

// Validazione dettagli lotto
const validateLotDetail = (detailData) => {
    const errors = [];
    
    if (detailData.cost_per_kg !== undefined && detailData.cost_per_kg < 0) {
        errors.push('Costo per kg non può essere negativo');
    }
    
    if (detailData.estimated_kg !== undefined && detailData.estimated_kg < 0) {
        errors.push('Kg stimati non possono essere negativi');
    }
    
    if (detailData.harvested_kg !== undefined && detailData.harvested_kg < 0) {
        errors.push('Kg raccolti non possono essere negativi');
    }
    
    if (detailData.purchase_date !== undefined) {
        const date = new Date(detailData.purchase_date);
        if (isNaN(date.getTime())) {
            errors.push('Data di acquisto non valida');
        }
    }
    
    return errors;
};

// GET /api/lots - Tutti i lotti (filtrati per proprietario)
router.get('/', async (req, res) => {
    try {
        // Ottieni l'ID dell'utente dal token
        const token = req.headers.authorization?.split(' ')[1];
        let currentUserId = null;
        let currentUserRole = null;
        let currentUsername = null;
        let parentId = null;
        
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, JWT_SECRET);
                currentUserId = decoded.id;
                currentUserRole = decoded.role;
                currentUsername = decoded.username;
                
                // Ottieni il parent_id dell'utente (se è un sottoutente)
                const user = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [currentUserId]);
                if (user && user.parent_id) {
                    parentId = user.parent_id;
                }
            } catch(e) {
                console.log('Token non valido:', e.message);
            }
        }
        
        let rows;
        
        // Se è super-admin (username 'admin'), vede tutti i lotti
        if (currentUsername === 'admin') {
            rows = await db.allAsync('SELECT * FROM lots ORDER BY created_at DESC');
        } 
        // Se è un sottoutente (ha parent_id), vede i lotti del suo admin
        else if (parentId) {
            rows = await db.allAsync(
                'SELECT * FROM lots WHERE owner_id = ? OR owner_username = ? ORDER BY created_at DESC',
                [parentId, currentUsername]
            );
        }
        // Altrimenti (admin normale o utente senza parent), vede i propri lotti
        else {
            rows = await db.allAsync(
                'SELECT * FROM lots WHERE owner_id = ? OR owner_username = ? ORDER BY created_at DESC',
                [currentUserId, currentUsername]
            );
        }
        
        res.json({
            message: 'success',
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Errore GET lots:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/lots/:id - Lotto specifico
router.get('/:id', async (req, res) => {
    try {
        const lot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        
        if (!lot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        res.json({
            message: 'success',
            data: lot
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/lots - Crea nuovo lotto
router.post('/', async (req, res) => {
    try {
        const { company_name, location, gps_coordinates, product_type, product_category, variety, field_lot, field_size, createdBy } = req.body;
        
        // Ottieni l'utente corrente dal token
        const token = req.headers.authorization?.split(' ')[1];
        let ownerId = null;
        let ownerUsername = null;
        let parentId = null;
        
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, JWT_SECRET);
                ownerId = decoded.id;
                ownerUsername = decoded.username;
                
                // Se l'utente ha un parent (è un sottoutente), usa il parent come owner
                const user = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [ownerId]);
                if (user && user.parent_id) {
                    parentId = user.parent_id;
                    // Ottieni il parent username
                    const parent = await db.getAsync('SELECT username FROM users WHERE id = ?', [parentId]);
                    ownerUsername = parent ? parent.username : ownerUsername;
                }
            } catch(e) {
                console.error('Errore verifica token:', e.message);
            }
        }
        
        // Determina l'owner finale: se c'è parentId, usa quello, altrimenti usa l'ID dell'utente
        const finalOwnerId = parentId || ownerId;
        
        console.log('📝 Creazione lotto per owner:', { 
            originalUserId: ownerId, 
            parentId: parentId,
            finalOwnerId: finalOwnerId,
            ownerUsername: ownerUsername 
        });
        
        // Validazione
        const errors = validateLot(req.body);
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Dati non validi',
                details: errors
            });
        }

        const result = await db.runAsync(
            `INSERT INTO lots (company_name, location, gps_coordinates, product_type, product_category, variety, field_lot, field_size, owner_id, owner_username, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [company_name, location, gps_coordinates, product_type, product_category || null, variety || null, field_lot || null, field_size || null, finalOwnerId, ownerUsername, createdBy || ownerUsername]
        );

        const newLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [result.id]);

        res.status(201).json({
            message: 'Lotto creato con successo',
            data: newLot
        });
    } catch (error) {
        console.error('❌ Errore creazione lotto:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/lots/:id - Aggiorna lotto (COMPLETO)
router.put('/:id', async (req, res) => {
    try {
        // Verifica che il lotto esista
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        if (!existingLot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        // Validazione
        const errors = validateLot(req.body, true);
        if (errors.length > 0) {
            return res.status(400).json({ 
                error: 'Dati non validi',
                details: errors 
            });
        }
        
        // Costruisci dinamicamente la query UPDATE
        const fields = [];
        const values = [];
        
        const updatableFields = [
            'company_name', 'location', 'gps_coordinates', 
            'product_type', 'product_category', 'variety', 'field_lot', 'field_size' // AGGIUNTO product_category
        ];
        
        updatableFields.forEach(field => {
            if (req.body[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        });
        
        if (fields.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare' });
        }
        
        values.push(req.params.id);
        
        const query = `UPDATE lots SET ${fields.join(', ')} WHERE id = ?`;
        
        const result = await db.runAsync(query, values);
        
        const updatedLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        
        res.json({
            message: 'Lotto aggiornato con successo',
            data: updatedLot
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/lots/:id - Elimina lotto
router.delete('/:id', async (req, res) => {
    try {
        // Verifica che il lotto esista
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        if (!existingLot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        // Elimina prima i dettagli (per integrità referenziale)
        await db.runAsync('DELETE FROM lot_details WHERE lot_id = ?', [req.params.id]);
        
        // Poi elimina il lotto
        const result = await db.runAsync('DELETE FROM lots WHERE id = ?', [req.params.id]);
        
        res.json({
            message: 'Lotto eliminato con successo',
            deleted_id: req.params.id,
            details_deleted: true
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/lots/:id - Aggiorna parziale
router.patch('/:id', async (req, res) => {
    try {
        // Verifica che il lotto esista
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        if (!existingLot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        // Validazione per update parziale
        const errors = validateLot(req.body, true);
        if (errors.length > 0) {
            return res.status(400).json({ 
                error: 'Dati non validi',
                details: errors 
            });
        }
        
        // Combina dati esistenti con nuovi dati
        const updatedData = { ...existingLot, ...req.body };
        
        const result = await db.runAsync(
            `UPDATE lots SET company_name = ?, location = ?, gps_coordinates = ?, 
             product_type = ?, product_category = ?, variety = ?, field_lot = ?, field_size = ? WHERE id = ?`, // AGGIUNTO product_category
            [
                updatedData.company_name,
                updatedData.location,
                updatedData.gps_coordinates,
                updatedData.product_type,
                updatedData.product_category, // AGGIUNTO
                updatedData.variety,
                updatedData.field_lot,
                updatedData.field_size,
                req.params.id
            ]
        );
        
        const updatedLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        
        res.json({
            message: 'Lotto aggiornato parzialmente',
            data: updatedLot
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== GESTIONE DETTAGLI LOTTO ====================

// POST /api/lots/:id/details - Aggiungi dettagli
router.post('/:id/details', async (req, res) => {
    try {
        const { cost_per_kg, estimated_kg, purchase_date, harvested_kg } = req.body;
        
        // Verifica che il lotto esista
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        if (!existingLot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        // Ottieni l'owner dal lotto (per ereditare la proprietà)
        const ownerId = existingLot.owner_id;
        const ownerUsername = existingLot.owner_username;
        
        // Validazione dettagli
        const errors = validateLotDetail(req.body);
        if (errors.length > 0) {
            return res.status(400).json({ 
                error: 'Dati non validi',
                details: errors 
            });
        }
        
        const result = await db.runAsync(
            `INSERT INTO lot_details (lot_id, cost_per_kg, estimated_kg, purchase_date, harvested_kg, owner_id, owner_username) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, cost_per_kg, estimated_kg, purchase_date, harvested_kg, ownerId, ownerUsername]
        );
        
        const newDetail = await db.getAsync('SELECT * FROM lot_details WHERE id = ?', [result.id]);
        
        res.status(201).json({
            message: 'Dettagli aggiunti con successo',
            data: newDetail
        });
    } catch (error) {
        console.error('Errore aggiunta dettagli:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/lots/:id/details/all - Tutti i dettagli del lotto
router.get('/:id/details/all', async (req, res) => {
    try {
        const details = await db.allAsync(
            `SELECT * FROM lot_details WHERE lot_id = ? ORDER BY purchase_date DESC, created_at DESC`,
            [req.params.id]
        );
        
        res.json({
            message: 'success',
            data: details
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/lots/:id/details - Dettagli lotto (ultimo record)
router.get('/:id/details', async (req, res) => {
    try {
        const details = await db.getAsync(
            `SELECT * FROM lot_details WHERE lot_id = ? ORDER BY created_at DESC LIMIT 1`,
            [req.params.id]
        );
        
        res.json({
            message: 'success',
            data: details || {}
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/lots/:id/details/:recordId - Dettaglio specifico
router.get('/:id/details/:recordId', async (req, res) => {
    try {
        const { id, recordId } = req.params;
        
        // Verifica che il lotto esista
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [id]);
        if (!existingLot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        const detail = await db.getAsync(
            `SELECT * FROM lot_details WHERE id = ? AND lot_id = ?`,
            [recordId, id]
        );
        
        if (!detail) {
            return res.status(404).json({ error: 'Record dettaglio non trovato' });
        }
        
        res.json({
            message: 'success',
            data: detail
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/lots/:lotId/details/:recordId - Aggiorna record dettaglio specifico
router.put('/:lotId/details/:recordId', async (req, res) => {
    try {
        const { lotId, recordId } = req.params;
        const { cost_per_kg, estimated_kg, purchase_date, harvested_kg } = req.body;

        console.log(`Aggiornamento record: lotId=${lotId}, recordId=${recordId}`, req.body);

        // Verifica che il lotto esista
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [lotId]);
        if (!existingLot) {
            return res.status(404).json({
                success: false,
                error: 'Lotto non trovato'
            });
        }

        // Trova il record da aggiornare
        const existingRecord = await db.getAsync(
            'SELECT * FROM lot_details WHERE id = ? AND lot_id = ?',
            [recordId, lotId]
        );

        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                error: 'Record non trovato'
            });
        }

        // ✅ CONTROLLO: Verifica che l'utente abbia i permessi per modificare
        // Ottieni l'utente corrente dal token
        const token = req.headers.authorization?.split(' ')[1];
        let currentUserId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, JWT_SECRET);
                currentUserId = decoded.id;
            } catch(e) {}
        }
        
        // Solo l'owner o il super-admin possono modificare
        if (currentUserId !== existingLot.owner_id && currentUserId !== 1) {
            return res.status(403).json({
                success: false,
                error: 'Non hai i permessi per modificare questo record'
            });
        }

        // Validazione dettagli
        const errors = validateLotDetail(req.body);
        if (errors.length > 0) {
            return res.status(400).json({ 
                error: 'Dati non validi',
                details: errors 
            });
        }

        // Costruisci dinamicamente la query UPDATE
        const fields = [];
        const values = [];
        
        const updatableFields = ['cost_per_kg', 'estimated_kg', 'purchase_date', 'harvested_kg'];
        
        updatableFields.forEach(field => {
            if (req.body[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        });
        
        if (fields.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare' });
        }
        
        // Aggiungi updated_at
        fields.push('updated_at = ?');
        values.push(new Date().toISOString());
        
        values.push(recordId, lotId);
        
        const query = `UPDATE lot_details SET ${fields.join(', ')} WHERE id = ? AND lot_id = ?`;
        
        const result = await db.runAsync(query, values);
        
        const updatedRecord = await db.getAsync(
            'SELECT * FROM lot_details WHERE id = ? AND lot_id = ?',
            [recordId, lotId]
        );

        res.json({
            success: true,
            message: 'Record aggiornato con successo',
            data: updatedRecord
        });

    } catch (error) {
        console.error('Errore aggiornamento record:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

// DELETE /api/lots/:lotId/details/:recordId - Elimina record dettaglio specifico
router.delete('/:lotId/details/:recordId', async (req, res) => {
    try {
        const { lotId, recordId } = req.params;

        console.log(`Eliminazione record: lotId=${lotId}, recordId=${recordId}`);

        // Verifica che il lotto esista
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [lotId]);
        if (!existingLot) {
            return res.status(404).json({
                success: false,
                error: 'Lotto non trovato'
            });
        }

        // ✅ CONTROLLO: Verifica che l'utente abbia i permessi per eliminare
        const token = req.headers.authorization?.split(' ')[1];
        let currentUserId = null;
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, JWT_SECRET);
                currentUserId = decoded.id;
            } catch(e) {}
        }
        
        // Solo l'owner o il super-admin possono eliminare
        if (currentUserId !== existingLot.owner_id && currentUserId !== 1) {
            return res.status(403).json({
                success: false,
                error: 'Non hai i permessi per eliminare questo record'
            });
        }

        // Trova il record da eliminare
        const existingRecord = await db.getAsync(
            'SELECT * FROM lot_details WHERE id = ? AND lot_id = ?',
            [recordId, lotId]
        );

        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                error: 'Record non trovato'
            });
        }

        // Elimina il record
        const result = await db.runAsync(
            'DELETE FROM lot_details WHERE id = ? AND lot_id = ?',
            [recordId, lotId]
        );

        res.json({
            success: true,
            message: 'Record eliminato con successo',
            deleted_id: recordId
        });

    } catch (error) {
        console.error('Errore eliminazione record:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

// GET /api/lots/:id/full - Lotto completo con dettagli
router.get('/:id/full', async (req, res) => {
    try {
        const lot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        
        if (!lot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        const details = await db.getAsync(
            `SELECT * FROM lot_details WHERE lot_id = ? ORDER BY created_at DESC LIMIT 1`,
            [req.params.id]
        );
        
        res.json({
            message: 'success',
            data: {
                ...lot,
                details: details || {}
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/lots/:id/statistics - Statistiche del lotto
router.get('/:id/statistics', async (req, res) => {
    try {
        const lot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        
        if (!lot) {
            return res.status(404).json({ error: 'Lotto non trovato' });
        }
        
        const statistics = await db.getAsync(`
            SELECT 
                COUNT(*) as total_records,
                AVG(cost_per_kg) as avg_cost_per_kg,
                SUM(estimated_kg) as total_estimated_kg,
                SUM(harvested_kg) as total_harvested_kg,
                MAX(created_at) as last_update
            FROM lot_details 
            WHERE lot_id = ?
        `, [req.params.id]);
        
        res.json({
            message: 'success',
            data: {
                lot: lot,
                statistics: statistics
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;