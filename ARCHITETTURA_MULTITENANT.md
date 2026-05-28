# 🏗️ VALUTAZIONE ARCHITETTURA - EVOLUZIONE MULTITENANT CLOUD

**Data**: 8 maggio 2026  
**Scenario**: Cropbook passa da single-tenant local → multitenant cloud  
**Urgenza**: 🔴 CRITICA (determinante per futuro dell'app)

---

## 📋 ANALISI COMPARATIVA

### Architettura Attuale vs Requisiti Futuri

```
ATTUALE                          RICHIESTO PER MULTITENANT CLOUD
════════════════════════════════════════════════════════════════════
SQLite locale                    ↓  Cloud DB (PostgreSQL/Firebase)
Backend + Frontend insieme       ↓  Separati (API + SPA/Mobile)
Dati in www/                     ↓  Cloud storage (AWS S3/GCS)
Sincronizzazione manuale         ↓  Real-time sync
Offline = non funziona           ↓  Offline-first con sync
1 istanza server                 ↓  Multi-region, load balanced
Nessun caching                   ↓  Redis/Memcached
JWT semplice                     ↓  JWT + refresh token + device id
Autorizzazioni parziali          ↓  RBAC completo + gerarchia utenti
Nessun audit log                 ↓  Completo audit trail
Nessun isolamento tenant         ↓  Data isolation per tenant
```

---

## ✅ COSA VA BENE (Fondamenta Solide)

### 1. **JWT Authentication** ✅ MANTENERE
```javascript
// ✅ Già presente e funzionante
const token = jwt.sign(
    { id: result.id, username, email, role },
    JWT_SECRET,
    { expiresIn: '7d' }
);
```
**Pro**: Stateless, perfetto per mobile/web/API  
**Nota**: Aggiungere refresh token per sicurezza

### 2. **Capacitor per Mobile/Web** ✅ MANTENERE
```javascript
// ✅ Già configurato
"@capacitor/android": "^7.4.4",
"@capacitor/core": "^7.4.4"
```
**Pro**: Un codebase per Android + iOS + Web  
**Cosa fare**: Separare app web da mobile app

### 3. **Schema Database con Parent_ID** ✅ BUON INIZIO
```sql
-- ✅ Presente nel database
parent_id INTEGER,
parent_username TEXT,
```
**Pro**: Gerarchia utenti già in schema  
**Problema**: parent_id è per gerarchia, non per tenant isolation

### 4. **Role-Based Access Control** ✅ INIZIO
```sql
-- ✅ Presente
role TEXT NOT NULL DEFAULT 'visitatore'
```
**Pro**: Sistema di ruoli già in place  
**Problema**: RBAC non implementato nelle route

---

## 🔴 PROBLEMI CRITICI PER MULTITENANT CLOUD

### 1. **DATABASE: SQLite → Cloud URGENTE**
```javascript
// ❌ ATTUALE
const dbPath = path.join(__dirname, 'cropbook.db');
const db = new sqlite3.Database(dbPath);
```

**Problemi**:
- ❌ SQLite è **LOCAL-ONLY**, non cloud
- ❌ Nessuna sincronizzazione tra dispositivi
- ❌ Non scalabile per migliaia di utenti
- ❌ Backup manuale
- ❌ No real-time updates

**Impatto**: 🔴 CRITICO  
User A cambia dati su mobile → non appare su PC di A1

### 2. **ISOLAMENTO DATI TENANT: Inesistente**
```sql
-- ❌ NON C'È ISOLAMENTO
SELECT * FROM lots WHERE owner_id = ? 
-- Nessuna verifica che owner_id != other_tenants
```

**Problema**: Se attaccante bypassa JWT, accede a TUTTI i dati  
**Scenario**: User A1 modifica URL query param lot_id → accede ai lotti di altri tenant!

### 3. **SINCRONIZZAZIONE OFFLINE: Inesistente**
```javascript
// ❌ ATTUALE: Se offline, app non funziona
// No service worker
// No SQLite locale per caching
// No sync quando torna online
```

**Problema**: Mobile offline → niente funziona  
**Richiesto**: Local SQLite + sync queue

### 4. **AUTORIZZAZIONI GRANULARI: Incomplete**
```javascript
// ❌ ATTUALE: Solo role check
if (req.user.role !== 'admin') { ... }

// ❌ MANCA: Resource-level authorization
// User A2 può editare lotto_id=5 di User A?
// User A2 può visualizzare analyses di User A1?
```

**Problema**: Nessun controllo su chi può editare cosa  
**Richiesto**: Policy-based RBAC (PBAC)

### 5. **API MONOLITICA: Frontend + Backend insieme**
```
www/
├── server.js          ← Backend
├── index.html         ← Frontend
└── routes/            ← API
```

**Problema**: 
- ❌ Non scalabile (backend server = frontend server)
- ❌ Difficile versioning API
- ❌ Mobile e Web condividono stesso code
- ❌ Deployment accoppiato

**Richiesto**: Separare API Backend da Frontend

### 6. **NESSUN SYNC REAL-TIME**
```javascript
// ❌ ATTUALE: Polling manuale
setInterval(() => { fetch('/api/lots'); }, 5000);

// ❌ MANCA: WebSocket/SSE per real-time
```

**Problema**: Se User A aggiorna dati, User A1 vede old data per 5 secondi  
**Richiesto**: WebSocket + event-driven architecture

### 7. **NESSUN AUDIT LOGGING**
```javascript
// ❌ MANCA: Chi ha modificato cosa e quando
// Nessun log di:
// - Chi ha creato il lotto
// - Chi l'ha modificato
// - Chi l'ha eliminato
// - Quando
```

**Impatto**: Non conformi a GDPR, impossibile tracciare problemi

---

## 📊 SCORECARD ARCHITETTURALE

### Per Requisiti ATTUALI (Single-tenant, local)
| Criterio | Score | Note |
|----------|-------|------|
| Semplicità | 9/10 | ✅ Facile da capire |
| Performance | 7/10 | ✅ Ok per pochi utenti |
| Scalabilità | 3/10 | ❌ Non scala |
| Sicurezza | 5/10 | ⚠️ Problema isolamento |
| **MEDIA** | **6/10** | Accettabile per v1 |

### Per Requisiti FUTURI (Multitenant, cloud)
| Criterio | Score | Note |
|----------|-------|------|
| Multitenant | 3/10 | ❌ Parziale (solo parent_id) |
| Cloud-readiness | 2/10 | ❌ SQLite è local-only |
| Synchronization | 0/10 | ❌ Inesistente |
| Offline-first | 0/10 | ❌ Non supportato |
| Real-time | 0/10 | ❌ Nessun sync live |
| Security/Isolation | 2/10 | ❌ No tenant isolation |
| API Scalability | 3/10 | ❌ Monolitica |
| **MEDIA** | **1.4/10** | 🔴 **INCOMPATIBILE** |

---

## 🎯 VERDICT: COSA FARE SUBITO

### OPZIONE A: Evoluzione Graduale (Consigliato)
```
Fase 1: Fixare security + stabilizzare v1 (2 settimane)
        ↓ Helmet, error handling, testing

Fase 2: Migrare a cloud DB + separare frontend (3-4 settimane)
        ↓ PostgreSQL cloud + React/Vue separate app

Fase 3: Implementare sync + offline-first (2-3 settimane)
        ↓ Service worker + local DB + WebSocket

Fase 4: Scale multitenant (2-3 settimane)
        ↓ Tenant isolation + RBAC + audit

Timeline totale: ~2 mesi → Production multitenant ready
```

### OPZIONE B: Refactor Completo (Veloce ma rischioso)
```
Rewritare completamente con Next.js + Firebase (3 settimane)
- Pro: Fast, serverless, built-in auth
- Con: Perdere codice attuale, learning curve
```

---

## 🚀 PASSI SUCCESSIVI CONCRETI

### PRIORITÀ 1: Database Migration (Settimana 2-3)

#### Scelta Cloud DB
```
OPZIONE A: Firebase Realtime DB
  ✅ Real-time sync built-in
  ✅ Offline support nativo
  ✅ No server manage
  ❌ Cost unpredictable
  ❌ Vendor lock-in

OPZIONE B: PostgreSQL Cloud (AWS RDS / Supabase)
  ✅ SQL familiare
  ✅ Scalabile
  ✅ Buon rapporto cost/performance
  ✅ Open source (self-hosted possible)
  ❌ Devi gestire sync
  ❌ No real-time built-in (aggiungi Socket.io)

OPZIONE C: MongoDB Atlas
  ✅ JSON-like data
  ✅ Scalabile
  ✅ Flexible schema
  ❌ No foreign keys
  ❌ Cost più alto

CONSIGLIO: PostgreSQL + Supabase
```

### PRIORITÀ 2: Tenant Isolation (Settimana 3-4)

#### Schema Nuovo
```sql
-- ✅ NUOVO SCHEMA PER MULTITENANT
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT, -- free, pro, enterprise
    created_at TIMESTAMP
);

-- Modificare tutti i dati aggiungere tenant_id
CREATE TABLE lots (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,  -- ← AGGIUNTO
    company_name TEXT,
    owner_id UUID,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    -- Row-level security: user può accedere SOLO ai dati con suo tenant_id
);

-- Gerarchia utenti all'interno tenant
CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,  -- ← AGGIUNTO
    username TEXT,
    email TEXT,
    password_hash TEXT,
    role TEXT, -- admin, manager, operator, viewer
    parent_id UUID, -- per gerarchia A → A1, A2
    created_at TIMESTAMP,
    UNIQUE(tenant_id, username), -- Username unico PER tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### PRIORITÀ 3: Autorizzazioni Granulari (Settimana 4-5)

#### RBAC + Policy-Based
```javascript
// ✅ NUOVA STRUTTURA
const permissions = {
    // Role-based
    'admin': ['*'],  // tutto
    'manager': [
        'lots:read', 'lots:create', 'lots:update',
        'activities:read', 'activities:create',
        'users:read', 'users:update_child'
    ],
    'operator': [
        'lots:read',
        'activities:read', 'activities:create'
    ],
    'viewer': ['lots:read', 'activities:read']
};

// ✅ Policy per resource (lot_id)
const canEditLot = (user, lot) => {
    // 1. Check role permission
    if (!permissions[user.role].includes('lots:update')) return false;
    
    // 2. Check data ownership
    if (lot.owner_id !== user.id && user.role !== 'admin') return false;
    
    // 3. Check gerarchia (A può editare dati di A1?)
    if (!isInHierarchy(user.id, lot.owner_id)) return false;
    
    // 4. Check tenant isolation (stesso tenant?)
    if (lot.tenant_id !== user.tenant_id) return false;
    
    return true;
};
```

### PRIORITÀ 4: Real-time Sync (Settimana 5-6)

#### WebSocket per Live Updates
```javascript
// ✅ NUOVA FEATURE
const WebSocket = require('ws');

wss.on('connection', (ws, req) => {
    const user = authenticateWS(req);
    
    // Subscribe a events del suo tenant
    db.watch([
        { $match: { 'fullDocument.tenant_id': user.tenant_id } }
    ]).on('change', (change) => {
        ws.send(JSON.stringify({
            type: 'update',
            resource: 'lots',
            action: change.operationType,
            data: change.fullDocument
        }));
    });
});

// Frontend
const ws = new WebSocket('ws://api.cropbook.com/sync');
ws.onmessage = (event) => {
    const { type, resource, data } = JSON.parse(event.data);
    if (type === 'update' && resource === 'lots') {
        updateUI(data); // Real-time update UI
    }
};
```

### PRIORITÀ 5: Offline-First (Settimana 6-7)

#### Service Worker + Local Storage
```javascript
// ✅ Service Worker per offline
self.addEventListener('fetch', (event) => {
    if (event.request.method === 'GET') {
        // Cached first
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    } else if (event.request.method === 'POST') {
        // Offline queue
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // Salva nella IndexedDB sync queue
                    return db.syncQueue.add({
                        method: 'POST',
                        url: event.request.url,
                        body: event.request.clone().json()
                    });
                })
        );
    }
});

// Quando torna online, sincronizza
addEventListener('online', async () => {
    const queue = await db.syncQueue.getAll();
    for (const item of queue) {
        const response = await fetch(item.url, {
            method: item.method,
            body: JSON.stringify(item.body)
        });
        if (response.ok) {
            await db.syncQueue.delete(item.id);
        }
    }
});
```

---

## 🗺️ TIMELINE REALISTICA

```
SETTIMANA 1-2: Stabilizzare v1 (Security + Tests)
   ✓ Abilitare Helmet
   ✓ Implementare error handling
   ✓ Setup Jest testing
   
SETTIMANA 3-4: Migrare Database
   ✓ Scegliere PostgreSQL/Supabase
   ✓ Creare nuovo schema con tenant_id
   ✓ Migration script da SQLite → Cloud
   ✓ Test della migrazione
   
SETTIMANA 5-6: Implementare Tenant Isolation
   ✓ Row-level security (RLS)
   ✓ Middleware di tenant verification
   ✓ Test di isolamento dati
   
SETTIMANA 7-8: Autorizzazioni Granulari
   ✓ Implementare RBAC completo
   ✓ Policy engine
   ✓ Gerarchia utenti funzionante
   
SETTIMANA 9-10: Real-time Sync
   ✓ WebSocket setup
   ✓ Change data capture
   ✓ Frontend real-time updates
   
SETTIMANA 11-12: Offline-First
   ✓ Service Worker
   ✓ IndexedDB sync queue
   ✓ Conflict resolution
   
SETTIMANA 13: Production Deploy
   ✓ Load testing
   ✓ Security audit
   ✓ Go live multitenant
```

**Timeline totale: ~3 mesi per multitenant cloud production-ready**

---

## 📋 DECISION MATRIX

Quale percorso scegliere?

### Percorso 1: Evoluzione Graduale ✅ CONSIGLIATO
```
Pro:
  ✅ Mantieni codice attuale
  ✅ Migrazioni incrementali
  ✅ Meno rischio
  ✅ Deploy frequenti
  
Con:
  ⏱️ 3 mesi di lavoro
  🔧 Refactoring complesso
  
Timeline: 3 mesi → Multitenant cloud
Best for: Team esperti di Node.js
```

### Percorso 2: Next.js + Firebase
```
Pro:
  ⚡ Veloce (~3 settimane)
  🔐 Security built-in
  ⛅ Serverless (no DevOps)
  📱 Full-stack modern
  
Con:
  🔓 Vendor lock-in (Google)
  💰 Cost imprevedibili
  🚫 Perdere codice attuale
  
Timeline: 3 settimane → MVP cloud
Best for: Startup, quick MVP
```

### Percorso 3: Aspettare + Rewrite Completo
```
Pro:
  🎯 Architettura perfetta
  
Con:
  ❌ NON lo consiglio
  ⏱️ Troppo tempo
  💀 Mantieni versione old in prod
  
Timeline: 4-5 mesi
Risk: Altissimo
```

---

## 🎯 RACCOMANDAZIONE FINALE

### ✅ IMPLEMENTARE PERCORSO 1 (Evoluzione Graduale)

**Motivi**:
1. Mantieni investimento attuale
2. Migrazioni incrementali = meno rischio
3. Deploy in produzione ogni 2 settimane
4. Team già conosce codebase

**Roadmap**:
```
Settimana 1-2:   Security hardening
Settimana 3-6:   Database migration → PostgreSQL/Supabase
Settimana 7-10:  Tenant isolation + RBAC
Settimana 11-12: Real-time sync + offline-first
Settimana 13:    Production deployment
```

**Checkpoints intermedi**:
- ✅ Settimana 2: v1.0.1 production (security fixes)
- ✅ Settimana 6: v1.1.0 production (cloud DB, single tenant)
- ✅ Settimana 10: v2.0.0 beta (multitenant + sync)
- ✅ Settimana 13: v2.0.0 production (multitenant cloud)

---

## 🔗 DIPENDENZE TRA STEP

```
┌─ Priority 1 (Cloud DB Migration) ──┐
│  (prerequisito per tutto)           │
│  ↓                                  │
├─ Priority 2 (Tenant Isolation) ────┤
│  ↓                                  │
├─ Priority 3 (Granular RBAC) ───────┤
│  ↓                                  │
├─ Priority 4 (Real-time Sync) ──────┤
│  ↓                                  │
├─ Priority 5 (Offline-First) ───────┤
│  ↓                                  │
└─ Production Deploy (Multitenant) ──┘
```

**Nota**: Non puoi saltare step!  
Es: Non fare real-time sync (Priority 4) prima di cloud DB (Priority 1)

---

## 📊 ROADMAP VISUALE

```
ADESSO (v1.0.0)        SETTIMANA 6 (v1.1.0)      SETTIMANA 13 (v2.0.0)
Single tenant          Cloud DB + Single tenant   Multitenant cloud
Local SQLite           PostgreSQL/Supabase        Real-time + Offline
┌──────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ SQLite local DB  │──▶│ PostgreSQL Cloud DB  │──▶│ PostgreSQL + Firebase│
│ No sync          │   │ Tenant isolation     │   │ Real-time WebSocket  │
│ Mobile + Web app │   │ RBAC started         │   │ Offline-first app    │
│ JWT auth         │   │ Mobile + Web tested  │   │ Gerarchia utenti OK  │
└──────────────────┘   └──────────────────────┘   └──────────────────────┘
```

---

**Prossimo step concreto**: Vedi ROADMAP_MULTITENANT.md per dettagli tecnici su come implementare
