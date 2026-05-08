# 🔧 INSTALLAZIONE PRIORITY 1 FIXES

**Data**: 8 maggio 2026  
**Status**: Codice applicato automaticamente ✅

---

## ✅ COSA È STATO FATTO AUTOMATICAMENTE

Ho applicato tutti i fix Priority 1 nel tuo workspace:

### 1. ✅ **Logger (Winston)** 
- File: `www/logger.js`
- Configurazione automatica per file logging
- Directory `logs/` creata automaticamente

### 2. ✅ **Test Setup (Jest)**
- File: `jest.config.js`
- Directory: `www/__tests__/auth.test.js`
- Test base per authentication

### 3. ✅ **RBAC Middleware**
- File: `www/middleware/rbac.js`
- 4 livelli di ruoli: admin, manager, operator, viewer
- Funzioni riutilizzabili

### 4. ✅ **.gitignore Aggiornato**
- Aggiunto logs/, coverage/, .env, temp files

### 5. ✅ **CORS Whitelist**
- Configurazione sicura con lista di origin consentiti
- Environment variable `ALLOWED_ORIGINS` supportata

### 6. ✅ **Error Handling**
- Global error handler migliorato
- 404 handler aggiunto
- Logging di errori completo

### 7. ✅ **Server Logging**
- Database logging abilitato
- Route logging con Winston

---

## 🚀 PROSSIMO STEP: INSTALLARE DIPENDENZE

Apri terminal e esegui:

```bash
cd www
npm install
```

Questo installerà:
- `winston` (3.11.0) - Logging
- `jest` (29.7.0) - Testing framework
- `supertest` (6.3.3) - HTTP assertions for testing

**Tempo**: ~3 minuti

---

## ✅ DOPO L'INSTALLAZIONE: VERIFICARE

### Test 1: Eseguire i test
```bash
npm test
```

**Output atteso**:
```
PASS  __tests__/auth.test.js
  Authentication Routes
    POST /api/auth/register
      ✓ should reject request without required fields
      ✓ should reject password shorter than 6 characters
      ...
    
  PASS (8 suite, 12 tests)
  Coverage: 50%+
```

### Test 2: Avviare il server
```bash
npm start
```

**Output atteso**:
```
[2026-05-08 14:30:15] [info]: ✅ Connesso al database SQLite
[2026-05-08 14:30:15] [info]: 🧪 Inizio caricamento routes
[2026-05-08 14:30:15] [info]: 🚀 Server AgriManager avviato!
```

### Test 3: Verificare logging
```bash
ls logs/
```

Deve contenere:
- `error.log` - Solo errori
- `combined.log` - Tutto

---

## 📋 COME USARE I NUOVI MIDDLEWARE

### Usare RBAC nelle route

**Prima** (senza RBAC):
```javascript
router.delete('/lots/:id', async (req, res) => {
    // Chiunque può cancellare
});
```

**Dopo** (con RBAC):
```javascript
const { requirePermission } = require('../middleware/rbac');

router.delete('/lots/:id', requirePermission('lots:delete'), async (req, res) => {
    // Solo chi ha 'lots:delete' permission può cancellare
});
```

### Ruoli disponibili

```javascript
const { ROLES } = require('../middleware/rbac');

// admin: ['*'] - accesso a tutto
// manager: ['lots:*', 'activities:*', 'users:*', 'economic:*']
// operator: ['lots:read', 'activities:*', 'analyses:*']
// viewer: ['lots:read', 'activities:read', 'analyses:read']
```

### Proteggere tutte le route

**In server.js, aggiungi:**
```javascript
const { requireAuth } = require('./middleware/rbac');

// Proteggere tutte le API
app.use('/api/', requireAuth);
```

---

## 🔍 VERIFICARE LOGGER

### Quando hai problemi, leggi i log

```bash
# Leggere file log
tail -f logs/combined.log

# O nel browser
# Vanno all'indirizzo http://localhost:3000/logs/
# (nota: attualmente non servito, ma puoi verificare il file)
```

**Log automatici**:
- Connessione database
- Route caricate
- Errori 404
- Errori server
- Accessi bloccati per permission
- CORS blocked

---

## 📝 PROSSIMI STEP

### Subito (30 min)
1. Installa dipendenze: `npm install`
2. Esegui test: `npm test`
3. Avvia server: `npm start`
4. Verifica che funziona

### Questa settimana (2-3 giorni)
1. Applicare RBAC a tutte le route principali (lots, activities, analyses)
2. Aggiungere test per ogni endpoint
3. Raggiungere 60%+ coverage

### Prossima settimana (Phase 2)
1. Migrare database a PostgreSQL/Supabase
2. Aggiungere tenant_id a schema
3. Implementare tenant isolation

---

## 🆘 TROUBLESHOOTING

### Errore: "Cannot find module 'winston'"
**Soluzione**: Hai dimenticato `npm install`. Esegui:
```bash
cd www
npm install
```

### Errore: "Cannot find module '../logger'"
**Soluzione**: Il file `logger.js` è in `www/`, assicurati di essere nella cartella corretta:
```bash
cd www
node server.js
```

### Test fallisce con "Cannot find module 'supertest'"
**Soluzione**: Installa devDependencies:
```bash
npm install --save-dev
```

### Port 3000 già in uso
**Soluzione**: Usa un'altra porta:
```bash
PORT=3001 npm start
```

---

## 📊 CHECKLIST POST-INSTALL

- [ ] `npm install` eseguito con successo
- [ ] `npm test` passa tutti i test (almeno 8/8)
- [ ] `npm start` avvia server senza errori
- [ ] File `logs/combined.log` creato
- [ ] CORS whitelist funziona (prova da diverse origini)
- [ ] Error handler cattura errori (prova 404: GET /invalid)

---

## 📚 PROSSIMI FILE DA AGGIORNARE

Una volta che tutto funziona, i prossimi step sono:

1. **Aggiungere RBAC a tutte le route** (lots.js, activities.js, analyses.js)
2. **Aumentare coverage a 70%** (aggiungere test per ogni endpoint)
3. **Database migration** (setup Supabase) - SETTIMANA PROSSIMA

---

## 🎯 GOAL SETTIMANA 1

```
├─ Lunedì: npm install + test base ✅
├─ Martedì-Mercoledì: Applicare RBAC alle route 
├─ Giovedì: Coverage 60%+
└─ Venerdì: v1.0.1 release
```

---

**File creati/aggiornati**:
- ✅ www/logger.js
- ✅ www/middleware/rbac.js
- ✅ www/__tests__/auth.test.js
- ✅ jest.config.js
- ✅ www/package.json (updated)
- ✅ www/server.js (updated)
- ✅ www/database.js (updated)
- ✅ .gitignore (updated)

**Prossimo**: `npm install` nel terminal
