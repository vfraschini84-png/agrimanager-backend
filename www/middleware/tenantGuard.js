// middleware/tenantGuard.js
// Utility riutilizzabile per bloccare IDOR (Insecure Direct Object Reference).
// Fonte unica di verità per il calcolo del tenant e per i controlli di accesso
// su risorse identificate da id in path/body.
//
// Regole:
//  - super-admin (`admin`) può accedere a qualunque tenant
//  - un utente "figlio" (parent_id valorizzato) eredita il tenant del padre
//  - tutti gli altri accedono solo alle risorse dove `owner_id === tenantOwnerId`

const db = require('../database');

const ADMIN_USERNAMES = new Set(['admin']);

/**
 * Ritorna l'owner_id effettivo del tenant dell'utente autenticato.
 * Se l'utente è "figlio" (parent_id), usa il parent_id; altrimenti req.user.id.
 * NON considera i super-admin (per quelli usare `isSuperAdmin`).
 */
async function getTenantOwnerId(req) {
    if (!req || !req.user) return null;
    const u = await db.getAsync('SELECT parent_id FROM users WHERE id = ?', [req.user.id]);
    return u?.parent_id || req.user.id;
}

/**
 * Il super-admin di piattaforma è SOLO l'utente con username='admin'.
 * Un utente registrato come `role: 'admin'` è invece un "tenant admin"
 * (proprietario di un tenant): deve essere confinato al suo tenant come
 * chiunque altro. Il vecchio check `req.user.role === 'admin'` bypassava
 * il tenant guard per qualunque tenant-admin — questa era una falla.
 */
function isSuperAdmin(req) {
    if (!req || !req.user) return false;
    return ADMIN_USERNAMES.has(req.user.username);
}

/**
 * Verifica che l'utente possa accedere al lotto con `lotId`.
 * @returns { lot } | { error: 404|403, message }
 */
async function assertLotAccess(req, lotId) {
    const lot = await db.getAsync('SELECT * FROM lots WHERE id = ?', [lotId]);
    if (!lot) return { error: 404, message: 'Lotto non trovato' };
    if (isSuperAdmin(req)) return { lot };
    const tenantOwnerId = await getTenantOwnerId(req);
    if (Number(lot.owner_id) !== Number(tenantOwnerId)) {
        return { error: 403, message: 'Accesso negato: risorsa di un altro tenant' };
    }
    return { lot };
}

/**
 * Verifica che l'utente possa accedere a un record generico che ha una colonna `owner_id`.
 * Utile per activities/analyses/costi_personale/costi_mezzi_tecnici/economic_records ecc.
 *
 * @param {import('express').Request} req
 * @param {string} table  nome tabella (whitelist interna per evitare SQL injection)
 * @param {number|string} id id del record
 * @returns { record } | { error: 404|403, message }
 */
const ALLOWED_TABLES = new Set([
    'activities',
    'analyses',
    'costi_personale',
    'costi_mezzi_tecnici',
    'economic_records',
    'lots'
]);

async function assertRecordAccess(req, table, id) {
    if (!ALLOWED_TABLES.has(table)) {
        // Errore di programmazione: fail-closed
        return { error: 500, message: `Tabella non autorizzata: ${table}` };
    }
    const record = await db.getAsync(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (!record) return { error: 404, message: 'Record non trovato' };
    if (isSuperAdmin(req)) return { record };
    const tenantOwnerId = await getTenantOwnerId(req);
    if (Number(record.owner_id) !== Number(tenantOwnerId)) {
        return { error: 403, message: 'Accesso negato: risorsa di un altro tenant' };
    }
    return { record };
}

/**
 * Middleware factory: verifica che il `lot_id` nel body o `:lotId`/`:lot_id`/`:id` in params
 * sia accessibile all'utente. Se OK, popola `req.tenantLot` col lotto e chiama next().
 */
function requireLotAccess({ from = 'params', field = 'lotId' } = {}) {
    return async (req, res, next) => {
        try {
            const source = from === 'body' ? (req.body || {}) : (req.params || {});
            const lotId = source[field];
            if (lotId === undefined || lotId === null || lotId === '') {
                return res.status(400).json({ error: `Parametro ${field} obbligatorio` });
            }
            const check = await assertLotAccess(req, lotId);
            if (check.error) return res.status(check.error).json({ error: check.message });
            req.tenantLot = check.lot;
            next();
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
}

/**
 * Middleware factory: verifica che il record `:id` di `table` sia accessibile.
 * Se OK popola `req.tenantRecord` col record.
 */
function requireRecordAccess(table, { field = 'id' } = {}) {
    return async (req, res, next) => {
        try {
            const id = (req.params || {})[field];
            const check = await assertRecordAccess(req, table, id);
            if (check.error) return res.status(check.error).json({ error: check.message });
            req.tenantRecord = check.record;
            next();
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
}

module.exports = {
    getTenantOwnerId,
    isSuperAdmin,
    assertLotAccess,
    assertRecordAccess,
    requireLotAccess,
    requireRecordAccess
};
