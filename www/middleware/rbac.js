// middleware/rbac.js - Role-Based Access Control
const logger = require('../logger');

const ROLES = {
    admin: {
        name: 'Administrator',
        permissions: ['*'] // Accesso a tutto
    },
    manager: {
        name: 'Manager',
        permissions: [
            'lots:read', 'lots:create', 'lots:update', 'lots:delete',
            'activities:read', 'activities:create', 'activities:update', 'activities:delete',
            'analyses:read', 'analyses:upload', 'analyses:create', 'analyses:delete',
            'users:read', 'users:create', 'users:update',
            'economic:read', 'economic:create', 'economic:update', 'economic:delete'
        ]
    },
    operator: {
        name: 'Operator',
        permissions: [
            'lots:read', 'lots:create', 'lots:update',
            'activities:read', 'activities:create', 'activities:update',
            'analyses:read', 'analyses:upload', 'analyses:create',
            'economic:read', 'economic:create', 'economic:update'
        ]
    },
    viewer: {
        name: 'Viewer',
        permissions: [
            'lots:read',
            'activities:read',
            'analyses:read',
            'economic:read'
        ]
    }
};

// Alias per supportare i ruoli storici in italiano salvati nel DB
const ROLE_ALIASES = {
    operatore: 'operator',
    visitatore: 'viewer'
};

/**
 * Risolve un ruolo (italiano o inglese) verso la chiave canonica di ROLES
 */
function resolveRole(role) {
    if (!role) return null;
    if (ROLES[role]) return role;
    return ROLE_ALIASES[role] || null;
}

/**
 * Check if user has permission
 * @param {Object} user - User object with role property
 * @param {string} requiredPermission - Permission to check (e.g., 'lots:create')
 * @returns {boolean}
 */
function hasPermission(user, requiredPermission) {
    if (!user || !user.role) return false;

    const canonicalRole = resolveRole(user.role);
    if (!canonicalRole) return false;

    const rolePermissions = ROLES[canonicalRole]?.permissions || [];

    // Admin ha accesso a tutto
    if (rolePermissions.includes('*')) return true;

    // Controlliamo la permission specifica
    return rolePermissions.includes(requiredPermission);
}

/**
 * Middleware per verificare se utente ha permission
 * @param {string} permission - Permission required
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            logger.warn('Accesso negato: non autenticato', {
                path: req.path,
                ip: req.ip
            });
            return res.status(401).json({
                error: 'Non autenticato',
                required: permission
            });
        }
        
        if (!hasPermission(req.user, permission)) {
            const canonical = resolveRole(req.user.role);
            logger.warn('Accesso negato: permission insufficiente', {
                user: req.user.username,
                role: req.user.role,
                required: permission,
                path: req.path
            });
            return res.status(403).json({
                error: 'Permessi insufficienti',
                required: permission,
                userRole: req.user.role,
                availablePermissions: ROLES[canonical]?.permissions || []
            });
        }
        
        logger.debug('Permission verificato', {
            user: req.user.username,
            permission
        });
        
        next();
    };
}

/**
 * Middleware per verificare se utente è autenticato
 */
function requireAuth(req, res, next) {
    if (!req.user) {
        logger.warn('Accesso negato: non autenticato', {
            path: req.path,
            ip: req.ip
        });
        return res.status(401).json({ error: 'Non autenticato' });
    }
    next();
}

/**
 * Middleware per verificare se utente è admin
 */
function requireAdmin(req, res, next) {
    return requirePermission('*')(req, res, next);
}

/**
 * Middleware per verificare se utente è proprietario della risorsa o admin
 * @param {string} ownerField - Nome del field che contiene owner_id
 */
function requireOwnerOrAdmin(ownerField = 'owner_id') {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non autenticato' });
        }
        
        // Admin può accedere a tutto
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Verificare se utente è proprietario
        const resourceOwnerId = req.resource?.[ownerField] || req.body?.[ownerField];
        
        if (resourceOwnerId && resourceOwnerId === req.user.id) {
            return next();
        }
        
        logger.warn('Accesso negato: non è proprietario della risorsa', {
            user: req.user.id,
            owner: resourceOwnerId,
            resource: req.resource
        });
        
        return res.status(403).json({
            error: 'Non sei il proprietario di questa risorsa'
        });
    };
}

module.exports = {
    ROLES,
    ROLE_ALIASES,
    resolveRole,
    hasPermission,
    requirePermission,
    requireAuth,
    requireAdmin,
    requireOwnerOrAdmin
};
