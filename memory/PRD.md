# PRD — AgriManager

**Ultimo aggiornamento**: 2026-05-08
**Versione**: 1.1.0 (post hardening)

---

## Problem statement
"Analizza la mia app" → analisi completa + applicazione di tutti i fix critici e importanti identificati su un'app Capacitor Android (Node/Express + SQLite + HTML monolitico) per la gestione di lotti agricoli.

## Stack
- Backend: Node.js 20 + Express 4 + SQLite3
- Auth: JWT + bcrypt
- Sicurezza: helmet, cors whitelist, express-rate-limit, compression
- Logging: Winston (file rotation + console dev)
- Docs: Swagger / OpenAPI 3.0 su `/api-docs`
- Mobile: Capacitor 7 + Geolocation + Preferences
- Test: Jest + Supertest (33 test attivi)

## Personas
- **Super-admin** (`username='admin'`): vede e gestisce tutto, può resettare password.
- **Admin azienda** (`role='admin'`): gestisce solo i propri sotto-utenti e i loro dati.
- **Operatore** (`role='operatore'` → mappato a `operator`): legge/crea/aggiorna lotti, attività, analisi, dati economici.
- **Visitatore** (`role='visitatore'` → mappato a `viewer`): solo lettura.
- **Manager** (`role='manager'`): tutti i permessi business escluso seed admin.

## Core requirements
- Multi-tenant via `parent_id` / `owner_id`.
- CRUD lotti, dettagli lotto (cost/kg, kg stimati, kg raccolti).
- Attività di raccolta con paginazione.
- Analisi (file upload metadata).
- Registrazioni economiche (ricavi, costi, ammortamenti).
- Costi mezzi tecnici e personale.
- Reset password via email (token 1h).

## Architettura tasks completate (sessione 2026-05-08)

### 🔴 Fix critici applicati
| # | Fix | File |
|---|---|---|
| 1 | Creato `.env` + `.env.example` con `JWT_SECRET` e fail-fast all'avvio | `www/.env`, `www/.env.example`, `www/server.js` |
| 2 | DB spostato fuori da `www/` in `/app/data/agrimanager.db` (configurabile via `DATABASE_PATH`) | `www/database.js` |
| 3 | Rimosso static serving dell'intera `www/` → solo `index.html` e `reset-password.html` | `www/server.js` |
| 4 | RBAC allineato: aggiunti alias `operatore→operator`, `visitatore→viewer`; `operator` ora ha anche `lots:create/update`, `economic:create/update` | `www/middleware/rbac.js` |
| 5 | Rimossa rotta `DELETE /api/auth/users/:id` duplicata che bypassava cascade-delete | `www/routes/auth.js` |
| 6 | Cascade delete ora in transazione `BEGIN/COMMIT/ROLLBACK` | `www/routes/auth.js`, `www/database.js` |
| 7 | SMTP credenziali spostate da hardcoded a env; mail di reset davvero inviata se SMTP configurato | `www/routes/auth.js`, `www/.env.example` |
| 8 | Forgot-password non logga più il link in produzione (solo NODE_ENV≠production) | `www/routes/auth.js` |
| 9 | Endpoint pubblici di `lots.js` ora richiedono auth+permission (GET /:id, /:id/details, /:id/details/all, POST/PUT/DELETE details) | `www/routes/lots.js` |
| 10 | `GET /api/lots` non accetta più anonymous con token invalido — risponde 401/403 | `www/routes/lots.js` |
| 11 | Init DB non più annidato (era dentro callback di `password_reset_tokens`) | `www/database.js` |
| 12 | Indici DB sempre creati, anche se prima callback fallisce | `www/database.js` |
| 13 | Aggiunti `requirePermission('economic:read'/'economic:create')` mancanti | `www/routes/economic.js` |
| 14 | Capacitor `appId` da `com.example.myapp` a `com.agrimanager.app` | `capacitor.config.ts` |
| 15 | Rate-limit specifico `/api/auth/login` e `/api/auth/forgot-password` (10 tentativi / 15 min) | `www/server.js` |
| 16 | Endpoint `/api/health` aggiunto | `www/server.js` |
| 17 | Graceful shutdown su SIGTERM/SIGINT con timeout 10s | `www/server.js` |
| 18 | `JWT_EXPIRES_IN` e `BCRYPT_SALT_ROUNDS` ora da env | `www/.env`, `www/routes/auth.js` |
| 19 | `PRAGMA foreign_keys = ON` su connessione SQLite | `www/database.js` |
| 20 | `app.set('trust proxy', 1)` per rate-limit dietro reverse proxy | `www/server.js` |
| 21 | CORS/CSP/`PUBLIC_URL` configurabili da env (rimosso IP hardcoded `192.168.0.69`) | `www/server.js` |

### 🧪 Test coverage
- Da 10 test passanti a **33 test passanti** in 4 suite:
  - `auth.test.js` (10): registrazione, login, validazioni
  - `rbac.test.js` (7): alias ruoli IT/EN, hasPermission
  - `lots.test.js` (8): protezione 401/403 sugli endpoint precedentemente pubblici
  - `server.test.js` (8): health, swagger, file `.db/.env/.js` non esposti, 404

## Test credentials
- Vedi `/app/memory/test_credentials.md`

## Cosa è già implementato dal team prima di questa sessione
- JWT auth con bcrypt
- Multi-tenant via parent_id
- Helmet con CSP custom
- CORS whitelist
- Rate-limit globale 100/15min
- Swagger API docs
- Winston logger con file rotation
- Backup script
- Reset password con token

## Backlog / Next steps

### P0 (blocking se va in produzione)
- [ ] Disabilitare `'unsafe-inline'` e `'unsafe-eval'` in CSP (richiede refactor del frontend monolitico)
- [ ] Aggiungere `helmet` HSTS attivo in produzione (force HTTPS)

### P1 (importanti)
- [ ] Refactor frontend `index.html` (11.152 righe / 423 KB) → bundling con Vite + componenti separati
- [ ] Sostituire residui `console.log` con `logger.*` in `economic.js`, `activities.js`, `analyses.js`, `costi.js`
- [ ] Validazione password più robusta (zxcvbn)
- [ ] Refresh token + endpoint `/api/auth/logout` con blacklist
- [ ] CI con GitHub Actions (test + lint)
- [ ] CSRF protection se passi a cookie auth
- [ ] Sanitizzazione HTML su campi `notes`/`description` per evitare XSS stored
- [ ] Test integration con DB in-memory `:memory:`

### P2 (miglioramenti)
- [ ] Docker multi-stage + docker-compose
- [ ] Migrazioni DB con Knex/Drizzle al posto del bootstrap manuale
- [ ] Monitoring (Sentry / OpenTelemetry)
- [ ] Cache Redis per query lente
- [ ] **Report PDF "Bilancio Stagione" per lotto** (suggerimento smart per upgrade Pro)
- [ ] Versionamento API `/api/v1/`
- [ ] TypeScript migration

## Avvio rapido
```bash
cd /app/www
npm install                 # già fatto
node server.js              # http://localhost:3000
# Test:
cd /app && npx jest --forceExit
```
