const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
const logger = require('../logger');
const { requirePermission, requireAuth } = require('../middleware/rbac');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware locale di autenticazione (riusato dai dettagli lotto)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: req.t ? req.t('errors.token_missing') : 'Token non fornito' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ error: req.t ? req.t('errors.token_invalid') : 'Token non valido' });
    }
}

// Verifica che l'utente abbia accesso al lotto richiesto (super-admin/admin OR proprietario tenant)
async function assertLotAccess(req, lotId) {
    const lot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [lotId]);
    if (!lot) return { error: 404, message: 'Lotto non trovato' };

    if (req.user.username === 'admin' || req.user.role === 'admin') {
        return { lot };
    }
    const u = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [req.user.id]);
    const tenantOwnerId = u?.parent_id || req.user.id;
    if (lot.owner_id !== tenantOwnerId) {
        return { error: 403, message: 'Accesso negato' };
    }
    return { lot };
}

// Validazione avanzata URL Google Maps
const isValidGoogleMapsUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const lowerUrl = url.toLowerCase().trim();
    if (lowerUrl.length === 0) return false;
    try {
        new URL(lowerUrl);
    } catch {
        return false;
    }
    const isGoogleDomain = lowerUrl.includes('google.') || lowerUrl.includes('goo.gl');
    if (!isGoogleDomain) return false;
    const mapsPatterns = ['/maps', 'maps.', 'place/', 'search/', 'dir/', '@'];
    const isMapsUrl = mapsPatterns.some(pattern => lowerUrl.includes(pattern));
    if (!isMapsUrl) return false;
    return true;
};

// Validazione lotto
const validateLot = (lotData, isUpdate = false) => {
    const errors = [];
    // ✅ company_name richiesto SOLO se non viene fornito company_id
    if (!isUpdate || lotData.company_name !== undefined) {
        if (!lotData.company_id) {
            const companyName = (lotData.company_name || '').trim();
            if (!companyName || companyName.length < 2) {
                errors.push('Indicare un\'azienda esistente (company_id) o un nome valido (company_name)');
            }
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
        if (gps && !isValidGoogleMapsUrl(gps)) {
            errors.push('Coordinate GPS devono essere un link Google Maps valido');
        }
    }
    return errors;
};

/**
 * @swagger
 * /api/lots:
 *   get:
 *     tags:
 *       - Lots
 *     summary: Elenca i lotti
 *     description: Ritorna la lista paginata dei lotti. Gli utenti normali vedono solo i loro lotti, gli admin vedono i lotti dei loro sottoutenti.
 *     parameters:
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
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista lotti con paginazione
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lot'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage: { type: integer }
 *                     itemsPerPage: { type: integer }
 *                     totalItems: { type: integer }
 *                     totalPages: { type: integer }
 *       400:
 *         description: Parametri di paginazione non validi
 *       500:
 *         description: Errore del server
 */
// ==================== GET / CON PAGINAZIONE ====================
router.get('/', authenticateToken, requirePermission('lots:read'), async (req, res) => {
    try {
        // ==================== PAGINAZIONE ====================
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        if (page < 1 || limit < 1 || limit > 100) {
            return res.status(400).json({ 
                error: 'Parametri di paginazione non validi. page >= 1, 1 <= limit <= 100' 
            });
        }
        
        // ==================== AUTENTICAZIONE ====================
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;
        const currentUsername = req.user.username;
        let parentId = null;

        const userRow = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [currentUserId]);
        if (userRow && userRow.parent_id) parentId = userRow.parent_id;
        
        // ==================== COSTRUZIONE QUERY ====================
        let whereClause = '';
        let params = [];
        let countParams = [];
        
        // SUPER-ADMIN
        if (currentUsername === 'admin') {
            whereClause = '';
        } 
        // ADMIN NORMALE
        else if (currentUserRole === 'admin') {
            const subUsers = await db.allAsync(
                'SELECT id FROM users WHERE parent_id = ?',
                [currentUserId]
            );
            const ownerIds = [currentUserId, ...subUsers.map(u => u.id)];
            const placeholders = ownerIds.map(() => '?').join(',');
            whereClause = `WHERE owner_id IN (${placeholders})`;
            params = ownerIds;
            countParams = ownerIds;
        } 
        // SOTTOUTENTE
        else if (parentId) {
            whereClause = `WHERE owner_id = ?`;
            params = [parentId];
            countParams = [parentId];
        } 
        // FALLBACK
        else {
            whereClause = `WHERE owner_id = ?`;
            params = [currentUserId];
            countParams = [currentUserId];
        }
        
        // ==================== QUERY PER IL TOTALE ====================
        const countQuery = `SELECT COUNT(*) as total FROM lots ${whereClause}`;
        const countResult = await db.getAsync(countQuery, countParams);
        const totalItems = countResult.total;
        const totalPages = Math.ceil(totalItems / limit);
        
        // ==================== QUERY PRINCIPALE ====================
        const query = `
            SELECT * FROM lots 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const queryParams = [...params, limit, offset];
        const lots = await db.allAsync(query, queryParams);
        
        // ==================== RISPOSTA CON PAGINAZIONE ====================
        res.json({
            message: 'success',
            data: lots,
            pagination: {
                currentPage: page,
                itemsPerPage: limit,
                totalItems: totalItems,
                totalPages: totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page < totalPages ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null
            }
        });
        
    } catch (error) {
        logger.error('Errore GET lots', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// GET /api/lots/:id - Lotto specifico
router.get('/:id', authenticateToken, requirePermission('lots:read'), async (req, res) => {
    try {
        const access = await assertLotAccess(req, req.params.id);
        if (access.error) return res.status(access.error).json({ error: access.message });
        res.json({ message: 'success', data: access.lot });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/lots/{id}:
 *   get:
 *     tags:
 *       - Lots
 *     summary: Ottiene un lotto specifico
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dettagli del lotto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Lot'
 *       404:
 *         description: Lotto non trovato
 *       500:
 *         description: Errore del server
 */
// GET /api/lots/:id - vedi sopra (autenticato)

/**
 * @swagger
 * /api/lots:
 *   post:
 *     tags:
 *       - Lots
 *     summary: Crea un nuovo lotto
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *               - location
 *               - product_type
 *             properties:
 *               company_name:
 *                 type: string
 *               location:
 *                 type: string
 *               gps_coordinates:
 *                 type: string
 *                 description: Link Google Maps valido
 *               product_type:
 *                 type: string
 *               field_size:
 *                 type: number
 *     responses:
 *       201:
 *         description: Lotto creato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Lot' }
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Autenticazione richiesta
 *       500:
 *         description: Errore del server
 */
// POST /api/lots - Crea nuovo lotto
router.post('/', authenticateToken, requirePermission('lots:create'), async (req, res) => {
    try {
        const { company_id, company_name, location, gps_coordinates, product_type, product_category, variety, field_lot, field_size, createdBy } = req.body;

        const ownerId = req.user.id;
        let ownerUsername = req.user.username;
        let parentId = null;

        const u = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [ownerId]);
        if (u && u.parent_id) {
            parentId = u.parent_id;
            const parent = await db.getAsync('SELECT username FROM users WHERE id = ?', [parentId]);
            ownerUsername = parent ? parent.username : ownerUsername;
        }

        const finalOwnerId = parentId || ownerId;

        const errors = validateLot(req.body);
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Dati non validi', details: errors });
        }
        
        // ✅ Gestione azienda: company_id se fornito, altrimenti crea/recupera da company_name
        let resolvedCompanyId = company_id || null;
        let resolvedCompanyName = company_name;
        if (resolvedCompanyId) {
            // ✅ RBAC: super-admin vede tutte le aziende; gli altri solo quelle del proprio tenant.
            //   Per admin con sotto-utenti consideriamo lo stesso owner_id (parent_id), già finalOwnerId.
            const isSuperAdmin = req.user.username === 'admin';
            const c = isSuperAdmin
                ? await db.getAsync(`SELECT id, name, owner_id FROM companies WHERE id = ?`, [resolvedCompanyId])
                : await db.getAsync(`SELECT id, name FROM companies WHERE id = ? AND owner_id = ?`, [resolvedCompanyId, finalOwnerId]);
            if (!c) {
                return res.status(400).json({ error: 'Azienda non valida o non autorizzata' });
            }
            resolvedCompanyName = c.name; // snapshot
            // Se super-admin, il lotto deve "agganciarsi" al tenant dell'azienda
            if (isSuperAdmin && c.owner_id) {
                const ownerCompanyUser = await db.getAsync('SELECT username FROM users WHERE id = ?', [c.owner_id]);
                ownerUsername = ownerCompanyUser?.username || ownerUsername;
                // forza il lotto sotto lo stesso owner dell'azienda
                req._tenantOwnerOverride = c.owner_id;
            }
        } else if (company_name) {
            // Auto-crea o riusa
            const existing = await db.getAsync(
                `SELECT id FROM companies WHERE owner_id = ? AND LOWER(name) = LOWER(?)`,
                [finalOwnerId, company_name.trim()]
            );
            if (existing) {
                resolvedCompanyId = existing.id;
            } else {
                const insC = await db.runAsync(
                    `INSERT INTO companies (name, owner_id, owner_username, created_by) VALUES (?, ?, ?, ?)`,
                    [company_name.trim(), finalOwnerId, ownerUsername, createdBy || ownerUsername]
                );
                resolvedCompanyId = insC.id;
            }
        }

        const effectiveOwnerId = req._tenantOwnerOverride || finalOwnerId;
        const result = await db.runAsync(
            `INSERT INTO lots (company_id, company_name, location, gps_coordinates, product_type, product_category, variety, field_lot, field_size, owner_id, owner_username, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [resolvedCompanyId, resolvedCompanyName, location, gps_coordinates, product_type, product_category || null, variety || null, field_lot || null, field_size || null, effectiveOwnerId, ownerUsername, createdBy || ownerUsername]
        );

        const newLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [result.id]);
        res.status(201).json({ message: 'Lotto creato con successo', data: newLot });
    } catch (error) {
        logger.error('Errore POST lotto', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/lots/{id}:
 *   put:
 *     tags:
 *       - Lots
 *     summary: Aggiorna un lotto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company_name: { type: string }
 *               location: { type: string }
 *               product_type: { type: string }
 *               field_size: { type: number }
 *     responses:
 *       200:
 *         description: Lotto aggiornato
 *       404:
 *         description: Lotto non trovato
 *       403:
 *         description: Accesso negato
 *       500:
 *         description: Errore del server
 */
// PUT /api/lots/:id - Aggiorna lotto
router.put('/:id', authenticateToken, requirePermission('lots:update'), async (req, res) => {
    try {
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        if (!existingLot) return res.status(404).json({ error: 'Lotto non trovato' });
        
        const errors = validateLot(req.body, true);
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Dati non validi', details: errors });
        }
        
        const fields = [];
        const values = [];
        const updatableFields = ['company_name', 'location', 'gps_coordinates', 'product_type', 'product_category', 'variety', 'field_lot', 'field_size'];
        
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
        await db.runAsync(`UPDATE lots SET ${fields.join(', ')} WHERE id = ?`, values);
        
        const updatedLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        res.json({ message: 'Lotto aggiornato con successo', data: updatedLot });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/lots/{id}:
 *   delete:
 *     tags:
 *       - Lots
 *     summary: Elimina un lotto
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
 *         description: Lotto eliminato
 *       404:
 *         description: Lotto non trovato
 *       403:
 *         description: Accesso negato
 *       500:
 *         description: Errore del server
 */
// DELETE /api/lots/:id - Elimina lotto
router.delete('/:id', authenticateToken, requirePermission('lots:delete'), async (req, res) => {
    try {
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        if (!existingLot) return res.status(404).json({ error: 'Lotto non trovato' });

        await db.withTransaction(async () => {
            await db.runAsync('DELETE FROM lot_details WHERE lot_id = ?', [req.params.id]);
            await db.runAsync('DELETE FROM activities WHERE lot_id = ?', [req.params.id]);
            await db.runAsync('DELETE FROM analyses WHERE lot_id = ?', [req.params.id]);
            await db.runAsync('DELETE FROM economic_records WHERE lot_id = ?', [req.params.id]);
            await db.runAsync('DELETE FROM lots WHERE id = ?', [req.params.id]);
        });

        res.json({ message: 'Lotto eliminato con successo', deleted_id: req.params.id });
    } catch (error) {
        logger.error('Errore DELETE lotto', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/lots/{id}:
 *   patch:
 *     tags:
 *       - Lots
 *     summary: Aggiornamento parziale di un lotto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company_name: { type: string }
 *               location: { type: string }
 *     responses:
 *       200:
 *         description: Lotto aggiornato
 *       404:
 *         description: Lotto non trovato
 *       403:
 *         description: Accesso negato
 *       500:
 *         description: Errore del server
 */
// PATCH /api/lots/:id - Aggiorna parziale
router.patch('/:id', authenticateToken, requirePermission('lots:update'), async (req, res) => {
    try {
        const existingLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        if (!existingLot) return res.status(404).json({ error: 'Lotto non trovato' });
        
        const errors = validateLot(req.body, true);
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Dati non validi', details: errors });
        }
        
        const updatedData = { ...existingLot, ...req.body };
        
        await db.runAsync(
            `UPDATE lots SET company_name = ?, location = ?, gps_coordinates = ?, 
             product_type = ?, product_category = ?, variety = ?, field_lot = ?, field_size = ? WHERE id = ?`,
            [updatedData.company_name, updatedData.location, updatedData.gps_coordinates,
             updatedData.product_type, updatedData.product_category, updatedData.variety, 
             updatedData.field_lot, updatedData.field_size, req.params.id]
        );
        
        const updatedLot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [req.params.id]);
        res.json({ message: 'Lotto aggiornato parzialmente', data: updatedLot });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== GESTIONE DETTAGLI LOTTO ====================

// GET /api/lots/:id/details/all - Tutti i dettagli del lotto
router.get('/:id/details/all', authenticateToken, requirePermission('lots:read'), async (req, res) => {
    try {
        const access = await assertLotAccess(req, req.params.id);
        if (access.error) return res.status(access.error).json({ error: access.message });

        const details = await db.allAsync(
            `SELECT * FROM lot_details WHERE lot_id = ? ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json({ message: 'success', data: details });
    } catch (error) {
        logger.error('Errore GET all details', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// GET /api/lots/:id/details - Ultimo dettaglio del lotto
router.get('/:id/details', authenticateToken, requirePermission('lots:read'), async (req, res) => {
    try {
        const access = await assertLotAccess(req, req.params.id);
        if (access.error) return res.status(access.error).json({ error: access.message });

        const details = await db.getAsync(
            `SELECT * FROM lot_details WHERE lot_id = ? ORDER BY created_at DESC LIMIT 1`,
            [req.params.id]
        );
        res.json({ message: 'success', data: details || {} });
    } catch (error) {
        logger.error('Errore GET details', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// POST /api/lots/:id/details - Aggiungi dettagli
router.post('/:id/details', authenticateToken, requirePermission('lots:update'), async (req, res) => {
    try {
        const access = await assertLotAccess(req, req.params.id);
        if (access.error) return res.status(access.error).json({ error: access.message });

        const { cost_per_kg, estimated_kg, purchase_date, harvested_kg } = req.body;
        const lot = access.lot;

        const result = await db.runAsync(
            `INSERT INTO lot_details (lot_id, cost_per_kg, estimated_kg, purchase_date, harvested_kg, owner_id, owner_username)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, cost_per_kg || null, estimated_kg || null, purchase_date || null, harvested_kg || null, lot.owner_id, lot.owner_username]
        );

        const newDetail = await db.getAsync('SELECT * FROM lot_details WHERE id = ?', [result.id]);
        res.status(201).json({ message: 'Dettagli aggiunti con successo', data: newDetail });
    } catch (error) {
        logger.error('Errore POST details', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/lots/:lotId/details/:detailId - Aggiorna dettaglio
router.put('/:lotId/details/:detailId', authenticateToken, requirePermission('lots:update'), async (req, res) => {
    try {
        const access = await assertLotAccess(req, req.params.lotId);
        if (access.error) return res.status(access.error).json({ error: access.message });

        const { detailId, lotId } = req.params;
        const { cost_per_kg, estimated_kg, purchase_date, harvested_kg } = req.body;

        const detail = await db.getAsync(
            'SELECT * FROM lot_details WHERE id = ? AND lot_id = ?',
            [detailId, lotId]
        );
        if (!detail) return res.status(404).json({ error: 'Dettaglio non trovato' });

        await db.runAsync(
            `UPDATE lot_details SET
                cost_per_kg = ?, estimated_kg = ?, purchase_date = ?, harvested_kg = ?,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [cost_per_kg || null, estimated_kg || null, purchase_date || null, harvested_kg || null, detailId]
        );

        const updated = await db.getAsync('SELECT * FROM lot_details WHERE id = ?', [detailId]);
        res.json({ message: 'Dettaglio aggiornato con successo', data: updated });
    } catch (error) {
        logger.error('Errore PUT detail', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/lots/:lotId/details/:detailId - Elimina dettaglio
router.delete('/:lotId/details/:detailId', authenticateToken, requirePermission('lots:delete'), async (req, res) => {
    try {
        const access = await assertLotAccess(req, req.params.lotId);
        if (access.error) return res.status(access.error).json({ error: access.message });

        const { detailId, lotId } = req.params;
        const detail = await db.getAsync(
            'SELECT * FROM lot_details WHERE id = ? AND lot_id = ?',
            [detailId, lotId]
        );
        if (!detail) return res.status(404).json({ error: 'Dettaglio non trovato' });

        await db.runAsync('DELETE FROM lot_details WHERE id = ?', [detailId]);
        res.json({ message: 'Dettaglio eliminato con successo', deleted_id: detailId });
    } catch (error) {
        logger.error('Errore DELETE detail', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;