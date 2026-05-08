# 🗺️ ROADMAP DI MIGLIORAMENTO

Questo documento fornisce un piano dettagliato per portare l'app da v1.0 a production-ready.

---

## 📊 Timeline Suggerita

```
SETTIMANA 1: Security & Stability (Priority 1)
├── Giorno 1-2: Security fixes (Helmet, database protection)
├── Giorno 2-3: Error handling & logging
└── Giorno 3-4: Basic testing setup

SETTIMANA 2: Quality & Documentation (Priority 2)
├── Giorno 1-2: API documentation (Swagger)
├── Giorno 2-3: Frontend refactoring
└── Giorno 3-4: RBAC implementation

SETTIMANA 3-4: Performance & DevOps (Priority 3)
├── Database optimization & indexing
├── Caching strategy
├── CI/CD pipeline
└── Docker containerization
```

---

## 🔴 FASE 1: SECURITY & STABILITY (Settimana 1)

### Sprint 1.1: Security Hardening (2 giorni)

#### Task 1.1.1: Abilitare Helmet.js ✅
- Tempo: 30 min
- Comandi:
```bash
# In www/server.js, riga ~10, uncomment e aggiorna:
app.use(helmet());
```

#### Task 1.1.2: Proteggere Database ✅
- Tempo: 30 min
- Azioni:
```bash
# 1. Creare directory
mkdir data
mkdir data/backups

# 2. Spostare file
mv www/agrimanager.db data/
mv www/backups/* data/backups/
rm -rf www/backups

# 3. Aggiornare percorsi nei file JS
# - database.js: const dbPath = path.join(__dirname, '..', 'data', 'agrimanager.db')
# - backup.js: destinationPath = path.join(__dirname, '../data/backups/...')
# - server.js: verificare che non serve la cartella data/

# 4. Creare .gitignore
echo "
data/
*.db
*.db-journal
.env
.env.local
node_modules/
*.log
logs/
" > .gitignore
```

#### Task 1.1.3: Implementare Error Handling ✅
- Tempo: 45 min
- Aggiungere in server.js (alla fine, prima di listen):
```javascript
// Global error handler DEVE essere ultimo!
app.use((err, req, res, next) => {
    const logger = require('./logger');
    logger.error('Unhandled error', { 
        message: err.message, 
        stack: err.stack,
        path: req.path,
        user: req.user?.username 
    });
    
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
});
```

#### Task 1.1.4: Setup Logging (Winston) ✅
- Tempo: 1 ora
```bash
npm install winston
# Creare logger.js (vedi GUIDA_FIX.md)
# Aggiornare tutte le route per usare logger invece di console.log
# Creare directory logs/
mkdir logs
```

---

### Sprint 1.2: Testing Foundation (2 giorni)

#### Task 1.2.1: Setup Jest ✅
- Tempo: 30 min
```bash
npm install --save-dev jest supertest @types/jest
npx jest --init
# Rispondere alle domande di configurazione
```

#### Task 1.2.2: Test Auth Module ✅
- Tempo: 1.5 ore
```bash
mkdir __tests__
# Creare __tests__/auth.test.js (vedi GUIDA_FIX.md)
npm test
```

#### Task 1.2.3: Test Coverage Setup ✅
- Tempo: 30 min
```bash
npm test -- --coverage
# Target: almeno 50% coverage su auth.js
```

---

## 🟡 FASE 2: QUALITY & DOCUMENTATION (Settimana 2)

### Sprint 2.1: API Documentation (1.5 giorni)

#### Task 2.1.1: Setup Swagger ✅
- Tempo: 1 ora
```bash
npm install swagger-jsdoc swagger-ui-express
# Creare swagger.js
# Aggiungere app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
```

#### Task 2.1.2: Document Routes ✅
- Tempo: 2 ore
```javascript
/**
 * @swagger
 * /api/lots:
 *   get:
 *     tags:
 *       - Lots
 *     summary: Fetch all lots with pagination
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of lots
 *       400:
 *         description: Invalid parameters
 */
```

### Sprint 2.2: Frontend Refactoring (1.5 giorni)

#### Task 2.2.1: Separate HTML/CSS/JS ✅
- Tempo: 2 ore
```bash
# Nuova struttura
www/
├── index.html          # Solo markup
├── css/
│   └── styles.css      # CSS estratto
├── js/
│   ├── app.js          # Entry point
│   ├── auth.js         # Auth logic
│   ├── lots.js         # Lots logic
│   └── utils.js        # Helper functions
└── server.js
```

#### Task 2.2.2: Modularize JavaScript ✅
- Tempo: 2 ore
```javascript
// js/auth.js
export async function login(username, password) {
    // ...
}

// js/app.js
import * as Auth from './auth.js';
document.getElementById('login-btn').addEventListener('click', () => {
    Auth.login(...);
});
```

### Sprint 2.3: RBAC Implementation (1 giorno)

#### Task 2.3.1: Create RBAC Middleware ✅
- Tempo: 30 min
- Creare middleware/rbac.js (vedi GUIDA_FIX.md)

#### Task 2.3.2: Apply to Routes ✅
- Tempo: 1.5 ore
- Aggiungere `requireRole()` a endpoint critici:
  - DELETE /api/lots/:id → admin, owner
  - POST /api/backup → admin
  - DELETE /api/users/:id → admin

---

## 🟠 FASE 3: PERFORMANCE & DEVOPS (Settimana 3-4)

### Sprint 3.1: Database Optimization (1 giorno)

#### Task 3.1.1: Add Indexes ✅
- Tempo: 30 min
```sql
-- database.js
CREATE INDEX IF NOT EXISTS idx_lots_owner ON lots(owner_id);
CREATE INDEX IF NOT EXISTS idx_lots_company ON lots(company_name);
CREATE INDEX IF NOT EXISTS idx_activities_lot ON activities(lot_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username UNIQUE);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email UNIQUE);
```

#### Task 3.1.2: Query Optimization ✅
- Tempo: 1 ora
- Profiling query lente
- Aggiungere EXPLAIN QUERY PLAN
- Ottimizzare join

#### Task 3.1.3: Implement Caching ✅
- Tempo: 2 ore
```bash
npm install redis
# Caching:
# - GET /api/lots (cache 5 min)
# - GET /api/analyses (cache 10 min)
# - Invalidare cache su POST/PUT/DELETE
```

### Sprint 3.2: CI/CD Pipeline (1.5 giorni)

#### Task 3.2.1: GitHub Actions ✅
- Tempo: 1 ora
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npm run lint
```

#### Task 3.2.2: Linting ✅
- Tempo: 30 min
```bash
npm install --save-dev eslint prettier
npx eslint --init
# Aggiungere script: "lint": "eslint . --fix"
```

#### Task 3.2.3: Auto Deployment ✅
- Tempo: 1.5 ore
```yaml
# Aggiungere step nel workflow:
  - name: Deploy to server
    if: github.ref == 'refs/heads/main'
    run: |
      # SSH deploy script
      ssh user@server "cd /app && git pull && npm install && npm test && pm2 restart agrimanager"
```

### Sprint 3.3: Containerization (1 giorno)

#### Task 3.3.1: Create Dockerfile ✅
- Tempo: 30 min
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY www ./www
COPY data ./data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "www/server.js"]
```

#### Task 3.3.2: Docker Compose ✅
- Tempo: 30 min
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DB_PATH: /app/data/agrimanager.db
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

---

## 📈 SUCCESS METRICS

| Metrica | Target | Attuale |
|---------|--------|---------|
| Test Coverage | > 70% | 0% |
| Security Score | A+ | C+ |
| API Documentation | 100% | 0% |
| Response Time (p95) | < 200ms | ? |
| Uptime | 99.9% | ? |
| Error Rate | < 0.1% | ? |

---

## 💰 ESTIMATION

| Fase | Durata | Risorse |
|------|--------|---------|
| Phase 1 (Security) | 4-5 giorni | 1 dev |
| Phase 2 (Quality) | 3-4 giorni | 1 dev |
| Phase 3 (DevOps) | 5-7 giorni | 1 dev + DevOps |
| **TOTALE** | **2-3 settimane** | **1-2 persone** |

---

## ✅ DELIVERABLES

### Phase 1 Complete
- [ ] Helmet.js enabled
- [ ] Database protected
- [ ] Error handling working
- [ ] Logging in place
- [ ] Basic test suite running
- [ ] 50% test coverage

### Phase 2 Complete
- [ ] Swagger API docs
- [ ] Frontend refactored
- [ ] RBAC working
- [ ] 70% test coverage

### Phase 3 Complete
- [ ] Database optimized
- [ ] CI/CD pipeline active
- [ ] Docker ready
- [ ] 80%+ test coverage
- [ ] Zero security warnings

---

## 🚀 PRODUCTION CHECKLIST

Prima di andare in produzione:

- [ ] Security audit completato
- [ ] Load testing: 1000+ concurrent users
- [ ] Performance testing: p95 < 200ms
- [ ] Test coverage > 80%
- [ ] All API endpoints documented
- [ ] Backup strategy tested
- [ ] Disaster recovery plan
- [ ] Monitoring setup (Sentry, DataDog, etc)
- [ ] Alerting configured
- [ ] Incident response playbook
- [ ] SLA defined

---

**Prossimo step**: Iniziare con Sprint 1.1 (Task 1.1.1) oggi stesso!
