# 🛠️ GUIDA AI FIX - PROBLEMI CRITICI

Questo documento contiene i fix per i problemi critici identificati nella valutazione.

---

## 1️⃣ PROBLEMA: Helmet.js Disabilitato

### Codice Attuale (INSICURO)
```javascript
// app.use(helmet({...})); // ❌ COMMENTATO
app.use(compression());
```

### Fix Consigliato
```javascript
// ✅ ABILITARE HELMET CON CONFIGURAZIONE SICURA
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "https://cdnjs.cloudflare.com",
                "https://kit.fontawesome.com",
                "https://cdn.jsdelivr.net"
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:3000"]
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true
}));
```

**Benefici**:
- Previene XSS attacks
- Previene Clickjacking (X-Frame-Options)
- Previene MIME-sniffing
- HSTS per forzare HTTPS

---

## 2️⃣ PROBLEMA: Database Esposto in www/

### Situazione Attuale (INSICURO)
```
www/
├── cropbook.db          ❌ ACCESSIBILE VIA HTTP
├── server.js
├── index.html
└── backups/                ❌ ACCESSIBILE
    └── *.db
```

### Fix Consigliato

**Step 1: Spostare database**
```bash
# Struttura corretta
cropbook-backend/
├── data/                           # ✅ NUOVA DIRECTORY
│   ├── cropbook.db
│   └── backups/
├── www/
│   ├── server.js
│   └── index.html
└── .env
```

**Step 2: Aggiornare percorsi in database.js**
```javascript
const dbPath = path.join(__dirname, '..', 'data', 'cropbook.db');
//                        ↑↑ Salire di 1 livello
```

**Step 3: Aggiornare percorsi in server.js**
```javascript
const dataDir = path.join(__dirname, '..', 'data');
const backupsDir = path.join(dataDir, 'backups');

// Proteggere rotte backup con autenticazione
app.post('/api/backup', authenticateToken, (req, res) => {
    // solo admin
});
```

**Step 4: Aggiornare .gitignore**
```bash
# .gitignore
data/
*.db
.env
node_modules/
*.log
backups/
```

---

## 3️⃣ PROBLEMA: Gestione Errori Insufficiente

### Codice Attuale (INSICURO)
```javascript
// Nessun middleware error handling globale
router.post('/register', async (req, res) => {
    try {
        // codice...
    } catch (e) {
        console.error(e); // ❌ Non invia risposta al client!
    }
});
```

### Fix Consigliato

**Aggiungere middleware globale in server.js:**
```javascript
// ==================== MIDDLEWARE ERROR HANDLING ====================
// DEVE ESSERE ULTIMO!
app.use((err, req, res, next) => {
    console.error('❌ ERROR:', err.message);
    console.error(err.stack);
    
    // Log strutturato (username, endpoint, error)
    const logEntry = {
        timestamp: new Date().toISOString(),
        error: err.message,
        endpoint: req.path,
        user: req.user?.username || 'anonymous'
    };
    
    // Non esporre dettagli errore al client
    const statusCode = err.status || 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;
    
    res.status(statusCode).json({ 
        error: message,
        ...(process.env.NODE_ENV === 'development' && { debug: err.message })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
```

**Aggiornare route per usare next(error):**
```javascript
router.post('/register', async (req, res, next) => {
    try {
        // codice...
    } catch (err) {
        next(err); // ✅ Passa a error handler
    }
});
```

---

## 4️⃣ PROBLEMA: Nessun Logging Strutturato

### Installare Winston
```bash
npm install winston
```

### Creare logger.js
```javascript
// logger.js
const winston = require('winston');
const path = require('path');

const logsDir = path.join(__dirname, 'logs');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'cropbook' },
    transports: [
        // File per errori
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'),
            level: 'error'
        }),
        // File per tutto
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log')
        })
    ],
});

// Console in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

module.exports = logger;
```

### Usare in server.js
```javascript
const logger = require('./logger');

// Sostituire console.log con logger
logger.info('🚀 Server avviato', { port: PORT });

// In routes
logger.info('Utente registrato', { username: user.username });
logger.error('Errore database', { error: err.message });
```

---

## 5️⃣ PROBLEMA: Nessun Test Automatico

### Setup Jest
```bash
npm install --save-dev jest supertest
npx jest --init
```

### Esempio test per auth.js
```javascript
// __tests__/auth.test.js
const request = require('supertest');
const app = require('../server');
const db = require('../database');

describe('POST /api/auth/register', () => {
    test('should register new user successfully', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                privacy_accepted: true
            });
        
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('message');
    });

    test('should reject short password', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'testuser',
                email: 'test@example.com',
                password: '123' // ❌ Too short
            });
        
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    test('should reject duplicate username', async () => {
        // First registration
        await request(app)
            .post('/api/auth/register')
            .send({
                username: 'duplicate',
                email: 'test1@example.com',
                password: 'password123',
                privacy_accepted: true
            });

        // Second with same username
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'duplicate',
                email: 'test2@example.com',
                password: 'password123',
                privacy_accepted: true
            });
        
        expect(res.statusCode).toBe(400);
    });
});
```

### Aggiornare package.json
```json
{
    "scripts": {
        "test": "jest --coverage",
        "test:watch": "jest --watch"
    }
}
```

---

## 6️⃣ PROBLEMA: CORS Troppo Permissivo

### Codice Attuale (INSICURO)
```javascript
app.use(cors()); // ✅ Permette TUTTI gli origin
```

### Fix Consigliato
```javascript
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600 // 10 minuti
}));
```

### File .env
```bash
ALLOWED_ORIGINS=http://localhost:3000,https://cropbook.app,https://app.cropbook.com
```

---

## 7️⃣ PROBLEMA: Nessuna Validazione RBAC

### Middleware RBAC
```javascript
// middleware/rbac.js
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non autenticato' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: `Ruolo ${req.user.role} non autorizzato. Richiesti: ${roles.join(', ')}`
            });
        }
        
        next();
    };
}

module.exports = { requireRole };
```

### Usare nelle route
```javascript
const { requireRole } = require('../middleware/rbac');

// Solo admin può eliminare utenti
router.delete('/users/:id', 
    authenticateToken, 
    requireRole('admin'),
    async (req, res, next) => {
        // ...
    }
);
```

---

## 📋 CHECKLIST IMPLEMENTAZIONE

- [ ] Abilitare Helmet.js
- [ ] Spostare database fuori www/
- [ ] Aggiungere error handling globale
- [ ] Installare Winston logger
- [ ] Setup Jest e test base
- [ ] Implementare CORS whitelist
- [ ] Aggiungere middleware RBAC
- [ ] Creare .gitignore corretto
- [ ] Aggiungere logs/ directory
- [ ] Test tutto localmente

---

**Tempo stimato**: 4-6 ore per implementare tutti i fix Priority 1  
**Priorità**: 🔴 ALTA - Implementare prima di any production deployment
