// __tests__/rbac.test.js - Verifica fix mismatch ruoli e protezioni endpoint
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { hasPermission, resolveRole, ROLES, ROLE_ALIASES } = require('../middleware/rbac');

describe('RBAC role aliases', () => {
    test('admin canonical', () => {
        expect(resolveRole('admin')).toBe('admin');
        expect(hasPermission({ role: 'admin' }, 'lots:create')).toBe(true);
        expect(hasPermission({ role: 'admin' }, 'whatever:anything')).toBe(true);
    });

    test('operatore IT viene risolto in operator', () => {
        expect(resolveRole('operatore')).toBe('operator');
        expect(hasPermission({ role: 'operatore' }, 'lots:create')).toBe(true);
        expect(hasPermission({ role: 'operatore' }, 'lots:read')).toBe(true);
        expect(hasPermission({ role: 'operatore' }, 'users:create')).toBe(false);
    });

    test('visitatore IT viene risolto in viewer', () => {
        expect(resolveRole('visitatore')).toBe('viewer');
        expect(hasPermission({ role: 'visitatore' }, 'lots:read')).toBe(true);
        expect(hasPermission({ role: 'visitatore' }, 'lots:create')).toBe(false);
        expect(hasPermission({ role: 'visitatore' }, 'lots:delete')).toBe(false);
    });

    test('ruolo sconosciuto → false', () => {
        expect(resolveRole('hacker')).toBe(null);
        expect(hasPermission({ role: 'hacker' }, 'lots:read')).toBe(false);
        expect(hasPermission(null, 'lots:read')).toBe(false);
        expect(hasPermission({}, 'lots:read')).toBe(false);
    });

    test('manager ha tutti i permessi business', () => {
        expect(hasPermission({ role: 'manager' }, 'economic:delete')).toBe(true);
        expect(hasPermission({ role: 'manager' }, 'lots:delete')).toBe(true);
    });

    test('ROLE_ALIASES contiene mappature italiane', () => {
        expect(ROLE_ALIASES.operatore).toBe('operator');
        expect(ROLE_ALIASES.visitatore).toBe('viewer');
    });

    test('ROLES ha 4 ruoli canonici', () => {
        expect(Object.keys(ROLES).sort()).toEqual(['admin', 'manager', 'operator', 'viewer']);
    });
});
