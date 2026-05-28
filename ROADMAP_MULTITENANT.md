# 🚀 ROADMAP TECNICA - MULTITENANT CLOUD

**Versione**: 1.0  
**Status**: Piano implementazione step-by-step  
**Tempo totale**: ~3 mesi per production-ready

---

## FASE 1: STABILIZZAZIONE v1.0 (Settimane 1-2)

### Checkpoint: v1.0.1 Production (Local SQLite + Security fixes)

#### Sprint 1.1: Security Hardening (Settimana 1)
- [ ] **Abilitare Helmet.js** (30 min)
  ```javascript
  app.use(helmet());
  ```

- [ ] **Database protection** (30 min)
  - Spostare cropbook.db fuori da www/
  - Aggiungere .gitignore

- [ ] **Error handling globale** (45 min)
  ```javascript
  app.use((err, req, res, next) => { ... });
  ```

- [ ] **Logging (Winston)** (1 ora)
  ```bash
  npm install winston
  ```

#### Sprint 1.2: Testing Foundation (Settimana 1-2)
- [ ] **Setup Jest** (30 min)
  ```bash
  npm install --save-dev jest supertest
  npx jest --init
  ```

- [ ] **Test auth.js** (1.5 ore)
  - Test register/login
  - Test token validation
  - Target: 50% coverage

- [ ] **CI/CD basic** (30 min)
  - GitHub Actions workflow
  - Run tests on push

**Deliverable**: v1.0.1 prodotto con 50% test coverage

---

## FASE 2: DATABASE MIGRATION (Settimane 3-6)

### Checkpoint: v1.1.0 Production (PostgreSQL Cloud + Single tenant)

#### Sprint 2.1: Scegliere Cloud DB (Giorno 1)

**OPZIONE A: Supabase (PostgreSQL + Firebase auth)**
```bash
# Installare
npm install @supabase/supabase-js

# .env
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_KEY=eyJhbGc...

# Usare
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);
```
✅ **Consigliato**: Facile, include auth, real-time, RLS

**OPZIONE B: AWS RDS PostgreSQL**
```bash
# Installare
npm install pg

# .env
DB_HOST=xyz.us-east-1.rds.amazonaws.com
DB_USER=postgres
DB_PASSWORD=...
DB_NAME=cropbook

# Usare
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432
});
```

**OPZIONE C: Firebase Realtime DB**
```bash
npm install firebase-admin

# Real-time + offline out-of-box
# Ma vendor lock-in
```

**RACCOMANDAZIONE**: Supabase (best of both worlds)

---

#### Sprint 2.2: Schema Database PostgreSQL (Giorno 2)

**Creare tables con tenant_id**:

```sql
-- ✅ NUOVA TABELLA TENANTS
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'free', -- free, pro, enterprise
    storage_limit INTEGER DEFAULT 5000000000, -- 5GB
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ✅ TABELLA USERS con tenant_id
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'visitatore', -- admin, manager, operator, viewer
    user_type TEXT DEFAULT 'libero_professionista',
    azienda_data JSONB,
    parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_username TEXT,
    privacy_accepted BOOLEAN DEFAULT FALSE,
    privacy_accepted_at TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(tenant_id, username),
    UNIQUE(tenant_id, email),
    FOREIGN KEY (tenant_id, parent_id) REFERENCES users(tenant_id, id)
);

-- ✅ TABELLA LOTS con tenant_id
CREATE TABLE IF NOT EXISTS lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    location TEXT NOT NULL,
    gps_coordinates TEXT,
    product_type TEXT NOT NULL,
    product_category TEXT,
    variety TEXT,
    field_lot TEXT,
    field_size REAL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_username TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ✅ TABELLA ACTIVITIES con tenant_id
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'raccolta',
    date TEXT NOT NULL,
    kg REAL NOT NULL,
    notes TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    owner_username TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ✅ TABELLA ANALYSES con tenant_id
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    filename TEXT,
    original_name TEXT,
    file_url TEXT,
    file_size TEXT,
    notes TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    owner_username TEXT,
    uploaded_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ✅ ROW LEVEL SECURITY (RLS) - Solo Supabase
-- In Supabase auth, abilita RLS per tabelle
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Politiche RLS (un utente vede solo i dati del suo tenant)
CREATE POLICY "users_tenant_isolation" ON users
    FOR ALL USING (tenant_id = auth.uid()); -- Se usi Supabase auth

CREATE POLICY "lots_tenant_isolation" ON lots
    FOR ALL USING (tenant_id = auth.uid());

-- INDICI PER PERFORMANCE
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_parent ON users(parent_id);
CREATE INDEX idx_lots_tenant ON lots(tenant_id);
CREATE INDEX idx_lots_owner ON lots(owner_id);
CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_activities_lot ON activities(lot_id);
CREATE INDEX idx_analyses_lot ON analyses(lot_id);
```

---

#### Sprint 2.3: Migration Script (Giorno 3-4)

**Creare script di migrazione SQLite → PostgreSQL**:

```javascript
// migration-sqlite-to-postgres.js
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');
const uuid = require('uuid');

const sqliteDb = new sqlite3.Database('./data/cropbook.db');
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL // From Supabase
});

async function migrate() {
    try {
        // 1. Leggere dati da SQLite
        const users = await getAllFromSQLite('users');
        const lots = await getAllFromSQLite('lots');
        const activities = await getAllFromSQLite('activities');
        const analyses = await getAllFromSQLite('analyses');
        
        // 2. Creare tenant default
        const tenantId = uuid.v4();
        await pgPool.query(
            'INSERT INTO tenants (id, name) VALUES ($1, $2)',
            [tenantId, 'Default Tenant']
        );
        
        // 3. Migrare users (SQLite id → UUID)
        const userIdMap = {};
        for (const user of users) {
            const newId = uuid.v4();
            userIdMap[user.id] = newId;
            
            await pgPool.query(
                `INSERT INTO users 
                (id, tenant_id, username, email, password_hash, role, user_type, azienda_data, parent_id, privacy_accepted, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    newId,
                    tenantId,
                    user.username,
                    user.email,
                    user.password_hash,
                    user.role,
                    user.user_type,
                    user.azienda_data,
                    user.parent_id ? userIdMap[user.parent_id] : null,
                    user.privacy_accepted,
                    user.created_at
                ]
            );
        }
        
        // 4. Migrare lots
        const lotIdMap = {};
        for (const lot of lots) {
            const newId = uuid.v4();
            lotIdMap[lot.id] = newId;
            
            await pgPool.query(
                `INSERT INTO lots 
                (id, tenant_id, company_name, location, gps_coordinates, product_type, owner_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [newId, tenantId, lot.company_name, lot.location, lot.gps_coordinates, lot.product_type, userIdMap[lot.owner_id], lot.created_at]
            );
        }
        
        // 5. Migrare activities con lot_id mappati
        for (const activity of activities) {
            const newId = uuid.v4();
            await pgPool.query(
                `INSERT INTO activities 
                (id, tenant_id, lot_id, date, kg, owner_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [newId, tenantId, lotIdMap[activity.lot_id], activity.date, activity.kg, userIdMap[activity.owner_id], activity.created_at]
            );
        }
        
        console.log('✅ Migrazione completata!');
    } catch (error) {
        console.error('❌ Errore migrazione:', error);
    } finally {
        await pgPool.end();
    }
}

migrate();
```

**Eseguire**:
```bash
npm install uuid pg
node migration-sqlite-to-postgres.js
```

---

#### Sprint 2.4: Aggiornare Backend per PostgreSQL (Giorno 4-5)

**Creare nuovo database.js per PostgreSQL**:

```javascript
// database-postgres.js
const { Pool } = require('pg');
const uuid = require('uuid');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const db = {
    // SELECT
    query: (sql, params = []) => pool.query(sql, params),
    
    // SELECT uno
    getOne: async (sql, params = []) => {
        const result = await pool.query(sql, params);
        return result.rows[0];
    },
    
    // SELECT tutti
    getAll: async (sql, params = []) => {
        const result = await pool.query(sql, params);
        return result.rows;
    },
    
    // INSERT
    insert: async (table, data, tenantId = null) => {
        const columns = Object.keys(data);
        if (tenantId) columns.push('tenant_id');
        
        const values = Object.values(data);
        if (tenantId) values.push(tenantId);
        
        const id = uuid.v4();
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${table} (id, ${columns.join(', ')}) 
                     VALUES ($${columns.length + 1}, ${placeholders}) 
                     RETURNING *`;
        
        const result = await pool.query(sql, [id, ...values]);
        return result.rows[0];
    },
    
    // UPDATE
    update: async (table, id, data) => {
        const columns = Object.keys(data);
        const values = Object.values(data);
        
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        const sql = `UPDATE ${table} SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`;
        
        const result = await pool.query(sql, [...values, id]);
        return result.rows[0];
    },
    
    // DELETE
    delete: async (table, id) => {
        const sql = `DELETE FROM ${table} WHERE id = $1`;
        await pool.query(sql, [id]);
    },
    
    // Pool per transazioni
    pool
};

module.exports = db;
```

**Aggiornare server.js**:
```javascript
// server.js
const db = require('./database-postgres'); // Cambiato da database.js

// Aggiungere middleware per tenant verification
app.use('/api/v1', (req, res, next) => {
    // Estrarre tenant_id dal token JWT
    if (req.user) {
        req.tenantId = req.user.tenant_id;
    }
    next();
});
```

---

#### Sprint 2.5: Testing Migration (Giorno 5-6)

```bash
# Test migration
npm test -- --testPathPattern=migration

# Test queries
npm test -- --testPathPattern=database

# Load testing (1000 users)
npm install -D autocannon
npx autocannon -c 100 http://localhost:3000/api/v1/lots
```

**Deliverable**: v1.1.0 con PostgreSQL cloud, single tenant, 70% test coverage

---

## FASE 3: TENANT ISOLATION (Settimane 7-10)

### Checkpoint: v1.2.0 Beta (Multitenant + RBAC)

#### Sprint 3.1: Implement RBAC (Settimana 7-8)

**Creare permissions system**:

```javascript
// middleware/rbac.js
const ROLES = {
    admin: {
        name: 'Administrator',
        permissions: ['*'] // Accesso a tutto
    },
    manager: {
        name: 'Manager',
        permissions: [
            'lots:read', 'lots:create', 'lots:update', 'lots:delete',
            'activities:read', 'activities:create', 'activities:update',
            'users:read', 'users:create', 'users:update',
            'analyses:read', 'analyses:upload'
        ]
    },
    operator: {
        name: 'Operator',
        permissions: [
            'lots:read',
            'activities:read', 'activities:create',
            'analyses:read'
        ]
    },
    viewer: {
        name: 'Viewer',
        permissions: [
            'lots:read',
            'activities:read',
            'analyses:read'
        ]
    }
};

function hasPermission(user, requiredPermission) {
    const rolePermissions = ROLES[user.role]?.permissions || [];
    return rolePermissions.includes('*') || rolePermissions.includes(requiredPermission);
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!hasPermission(req.user, permission)) {
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                required: permission,
                userRole: req.user.role
            });
        }
        
        next();
    };
}

module.exports = { ROLES, hasPermission, requirePermission };
```

**Applicare alle routes**:

```javascript
// routes/lots.js
const { requirePermission } = require('../middleware/rbac');

router.get('/', requirePermission('lots:read'), async (req, res) => {
    // Solo utenti con permission 'lots:read'
});

router.post('/', requirePermission('lots:create'), async (req, res) => {
    // Solo utenti con permission 'lots:create'
});

router.delete('/:id', requirePermission('lots:delete'), async (req, res) => {
    // Solo utenti con permission 'lots:delete'
});
```

---

#### Sprint 3.2: Gerarchia Utenti (Settimana 8-9)

**Implementare parent-child relationships**:

```javascript
// middleware/hierarchy.js
async function canManageUser(currentUser, targetUserId) {
    // 1. Admin può gestire chiunque
    if (currentUser.role === 'admin') return true;
    
    // 2. Manager può gestire solo i suoi subordinati
    const targetUser = await db.getOne(
        'SELECT * FROM users WHERE id = $1 AND tenant_id = $2',
        [targetUserId, currentUser.tenant_id]
    );
    
    if (!targetUser) return false;
    
    // 3. Verificare se targetUser è un subordinato
    return isSubordinate(currentUser.id, targetUser.id);
}

async function isSubordinate(parentId, userId) {
    const user = await db.getOne(
        'SELECT * FROM users WHERE id = $1',
        [userId]
    );
    
    if (!user || !user.parent_id) return false;
    if (user.parent_id === parentId) return true;
    
    // Ricorsivo: verificare nonno, bisnonno, etc.
    return isSubordinate(parentId, user.parent_id);
}

module.exports = { canManageUser, isSubordinate };
```

**Usare nelle route**:

```javascript
// routes/users.js
const { canManageUser } = require('../middleware/hierarchy');

router.put('/users/:id', requirePermission('users:update'), async (req, res, next) => {
    try {
        if (!await canManageUser(req.user, req.params.id)) {
            return res.status(403).json({ error: 'Cannot manage this user' });
        }
        
        // Aggiornare utente
        const updated = await db.update('users', req.params.id, req.body);
        res.json(updated);
    } catch (err) {
        next(err);
    }
});
```

---

#### Sprint 3.3: Data Isolation (Settimana 9-10)

**Middleware per tenant verification**:

```javascript
// middleware/tenantIsolation.js
async function verifyTenantAccess(req, res, next) {
    try {
        const { id } = req.params;
        const table = detectTable(req.path); // lots, activities, analyses, etc
        
        // Verificare che il record appartiene al tenant dell'utente
        const record = await db.getOne(
            `SELECT tenant_id FROM ${table} WHERE id = $1`,
            [id]
        );
        
        if (!record) {
            return res.status(404).json({ error: 'Not found' });
        }
        
        if (record.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ error: 'Access denied: different tenant' });
        }
        
        req.resource = record;
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { verifyTenantAccess };
```

**Applicare globalmente**:

```javascript
// server.js
const { verifyTenantAccess } = require('./middleware/tenantIsolation');

// Tutti i record GET/PUT/DELETE verificano tenant
app.get('/api/v1/lots/:id', verifyTenantAccess, (req, res) => { ... });
app.put('/api/v1/lots/:id', verifyTenantAccess, (req, res) => { ... });
app.delete('/api/v1/lots/:id', verifyTenantAccess, (req, res) => { ... });
```

**Deliverable**: v1.2.0 beta con RBAC + tenant isolation + hierarchy

---

## FASE 4: REAL-TIME SYNC (Settimane 11-12)

### Checkpoint: v2.0.0 Beta (WebSocket + Live updates)

#### Sprint 4.1: WebSocket Setup

```bash
npm install ws socket.io
```

```javascript
// websocket.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });
const clients = new Map(); // Map of tenant_id → Set of connections

wss.on('connection', (ws, req) => {
    const token = req.url.split('token=')[1];
    const user = authenticateWS(token);
    
    if (!user) {
        ws.close(1008, 'Unauthorized');
        return;
    }
    
    // Iscritti tenant
    if (!clients.has(user.tenant_id)) {
        clients.set(user.tenant_id, new Set());
    }
    clients.get(user.tenant_id).add(ws);
    
    ws.on('message', (data) => {
        const message = JSON.parse(data);
        handleWSMessage(user, message, ws);
    });
    
    ws.on('close', () => {
        clients.get(user.tenant_id).delete(ws);
    });
});

// Broadcast a tenant
function broadcastToTenant(tenantId, message) {
    if (clients.has(tenantId)) {
        clients.get(tenantId).forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

module.exports = { wss, broadcastToTenant };
```

#### Sprint 4.2: Database Change Streams

```javascript
// Per PostgreSQL with Supabase
// Usare Realtime Subscriptions

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Subscribe a changes
supabase
    .from('lots')
    .on('*', (payload) => {
        const tenantId = payload.new.tenant_id || payload.old.tenant_id;
        
        broadcastToTenant(tenantId, {
            type: 'update',
            resource: 'lots',
            action: payload.eventType, // INSERT, UPDATE, DELETE
            data: payload.new || payload.old
        });
    })
    .subscribe();
```

**Deliverable**: v2.0.0 beta con real-time updates via WebSocket

---

## FASE 5: OFFLINE-FIRST (Settimana 13)

### Checkpoint: v2.0.0 Production

#### Sprint 5.1: Service Worker + Cache

```javascript
// public/service-worker.js
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('cropbook-v2').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/css/styles.css',
                '/js/app.js'
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method === 'GET') {
        // Cache first for static assets
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    } else if (event.request.method === 'POST' || event.request.method === 'PUT') {
        // Network first, fallback to offline queue
        event.respondWith(
            fetch(event.request).catch(() => {
                return queueRequest(event.request);
            })
        );
    }
});
```

#### Sprint 5.2: Offline Queue & Sync

```javascript
// js/syncManager.js
class SyncManager {
    async queueRequest(request) {
        const db = await this.openDB();
        const store = db.transaction(['syncQueue'], 'readwrite').objectStore('syncQueue');
        
        const body = await request.clone().json();
        
        store.add({
            method: request.method,
            url: request.url,
            body: body,
            timestamp: Date.now()
        });
    }
    
    async syncOnOnline() {
        window.addEventListener('online', async () => {
            const db = await this.openDB();
            const store = db.transaction(['syncQueue'], 'readwrite').objectStore('syncQueue');
            const all = await store.getAll();
            
            for (const item of all) {
                try {
                    const response = await fetch(item.url, {
                        method: item.method,
                        body: JSON.stringify(item.body),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (response.ok) {
                        store.delete(item.timestamp);
                    }
                } catch (err) {
                    console.error('Sync failed:', err);
                    // Retry prossima volta online
                }
            }
        });
    }
    
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('cropbook', 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore('syncQueue', { keyPath: 'timestamp' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

const syncManager = new SyncManager();
syncManager.syncOnOnline();
```

**Deliverable**: v2.0.0 production con offline support completo

---

## 📋 CHECKLIST IMPLEMENTAZIONE

### Fase 1 (Settimane 1-2)
- [ ] Abilitare Helmet
- [ ] Error handling globale
- [ ] Setup logging (Winston)
- [ ] Setup Jest
- [ ] Test auth.js
- [ ] GitHub Actions workflow
- [ ] v1.0.1 released

### Fase 2 (Settimane 3-6)
- [ ] Scegliere Supabase
- [ ] Creare schema PostgreSQL
- [ ] Migration script (SQLite → Postgres)
- [ ] Aggiornare backend per Postgres
- [ ] Testing migration
- [ ] Load testing (1000 users)
- [ ] v1.1.0 released

### Fase 3 (Settimane 7-10)
- [ ] Implementare RBAC completo
- [ ] Gerarchia utenti funzionante
- [ ] Tenant isolation middleware
- [ ] CRUD con tenant verification
- [ ] Test isolation
- [ ] v1.2.0 beta released

### Fase 4 (Settimane 11-12)
- [ ] WebSocket setup
- [ ] Database change streams
- [ ] Real-time frontend updates
- [ ] Conflict resolution
- [ ] v2.0.0 beta released

### Fase 5 (Settimana 13)
- [ ] Service Worker
- [ ] Offline queue
- [ ] Sync on reconnect
- [ ] Full offline test
- [ ] Production deployment
- [ ] v2.0.0 released

---

## 🎯 NEXT IMMEDIATE STEP

**Questa settimana**: Inizia Fase 1 (Security + Testing)

1. Apri GUIDA_FIX.md
2. Implementa Priority 1 (4-6 ore)
3. Esegui test
4. Push v1.0.1

**Prossima settimana**: Inizia Fase 2 (DB Migration)

---

**Documento creato**: 8 maggio 2026  
**Versione**: 1.0
