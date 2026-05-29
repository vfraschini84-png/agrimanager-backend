# PRD — Cropbook

**Ultimo aggiornamento**: 2026-05-29
**Versione**: 1.5.1

---

## Problem statement
"Analizza la mia app" → analisi completa + applicazione di tutti i fix critici e poi una serie di feature improvements su un'app Capacitor Android (Node/Express + SQLite + HTML monolitico) per la gestione di lotti agricoli.

## Stack
- Backend: Node.js 20 + Express 4 + SQLite3 (file `/app/data/cropbook.db`, fuori da www/)
- Auth: JWT + bcrypt
- Sicurezza: helmet, cors whitelist con regex, express-rate-limit, compression
- Logging: Winston (file rotation + console dev)
- Docs: Swagger / OpenAPI 3.0 su `/api-docs`
- Mobile: Capacitor 7 + Geolocation + Preferences
- Test: Jest + Supertest (36 test attivi)
- PDF: pdfkit + chartjs-node-canvas (per report bilancio)
- Email: nodemailer (SMTP da env)
- Process manager: supervisor (program `cropbook`)

## Personas
- **Super-admin** (`username='admin'`): vede e gestisce tutto, può resettare password.
- **Admin azienda** (`role='admin'`): gestisce solo i propri sotto-utenti e i loro dati.
- **Operator** (`role='operatore'` → mappato a `operator`): legge/crea/aggiorna lotti, attività, analisi, dati economici.
- **Viewer** (`role='visitatore'` → mappato a `viewer`): solo lettura.
- **Manager** (`role='manager'`): tutti i permessi business.

## Core requirements
- Multi-tenant via `parent_id` / `owner_id`.
- CRUD lotti, dettagli lotto (cost/kg, kg stimati, kg raccolti).
- Attività di raccolta con paginazione.
- Analisi (file upload metadata).
- Registrazioni economiche (ricavi, costi, ammortamenti).
- Costi mezzi tecnici e personale.
- Reset password via email (token 1h).
- Report PDF "Bilancio Stagione".

---

## Cronologia implementazioni

### Sessione 1 (2026-05-08): hardening security
21 fix critici applicati: .env + JWT_SECRET, RBAC alias IT/EN, dedup DELETE users cascade, DB fuori da www/, static restrittivo, SMTP da env, transazioni, init DB sequenziale, CORS pattern, rate-limit login, /api/health, graceful shutdown.

### Sessione 2 (2026-05-08): privacy ereditata sotto-utenti
- Backend: `POST /api/auth/register` se token Bearer valido + creator ha privacy → eredita su sotto-utente
- DB: super-admin di seed con `privacy_accepted=1` + migrazione per admin esistenti

### Sessione 3 (2026-05-09): UX & feature improvements
| # | Modifica | File |
|---|---|---|
| 1 | **Auto-promozione** primo utente registrato pubblicamente → admin (se DB vuoto, esclusi seed). Eliminato il selettore ruolo dalla registrazione pubblica → input nascosto + box info verde | `routes/auth.js`, `index.html` |
| 2 | Form gestione utenti rinnovato: campo **Email**, **show/hide password**, generatore **password casuale**, checkbox **invio credenziali via email** | `index.html` |
| 3 | Endpoint `POST /api/auth/register` ora invia automaticamente le credenziali via SMTP se `send_credentials_email: true` e SMTP configurato | `routes/auth.js` |
| 4 | **Lista utenti compatta + responsive** con avatar circolare, badge ruolo colorati, contrasti corretti (testo scuro su sfondo chiaro / bianco su scuro). Su mobile: layout verticale con azioni in fondo, label nascoste | `index.html` (CSS .user-card*) |
| 5 | **Icona home nell'header** (sostituisce i pulsanti "Torna alla home" in-section che causavano scroll-jump). Visibile su tutte le sezioni eccetto home. Mobile-friendly con touch-target 40px | `index.html` (CSS + addHomeButton + goHome) |
| 6 | **Smooth scroll** + `overscroll-behavior-y: contain` per evitare scroll-jump mobile | `index.html` (CSS body/html) |
| 7 | Nuovo endpoint **`GET /api/reports/bilancio/:lotId?stagione=YYYY`** con pdfkit + chartjs-node-canvas → genera PDF A4 con KPI, 2 grafici (donut ricavi/costi + bar costi breakdown), tabella registrazioni economiche, footer con paginazione | `routes/reports.js` (nuovo) |
| 8 | Bottone "Report PDF Stagione" affianco a "Excel Completo" nella sezione Bilancio (grid 2-col responsive) | `index.html` |
| 9 | **Rimosso box "Credenziali di test"** dalla schermata di login | `index.html` |
| 10 | Server NON ascolta in test mode (per Supertest in-process) | `server.js` |
| 11 | Server ora gestito da **supervisor** (`cropbook` program) → autostart + autorestart | `/etc/supervisor/conf.d/supervisord_cropbook.conf` |

### Test coverage
- **48 test passanti** in 7 suite:
  - `auth.test.js` (10): registrazione, login, validazioni
  - `rbac.test.js` (7): alias ruoli IT/EN
  - `lots.test.js` (8): protezione 401/403 endpoint
  - `server.test.js` (8): health, swagger, file safety
  - `sub-user-registration.test.js` (3): privacy ereditata
  - `admin-dev.test.js` (8): pannello sviluppatore server-side
  - `reset-password.test.js` (4): atomicità transazionale + scadenza token

### Sessione 4 (2026-05-29): security hardening pannello sviluppatore + reset password
| # | Modifica | File |
|---|---|---|
| 1 | **Pannello sviluppatore protetto server-side**: nuovo router `/api/admin/dev/*` con doppia auth (JWT + dev-session token JWT scope=dev, scadenza 30min), bcrypt-hash della dev password in `.env` (`DEV_PASSWORD_HASH`), rate-limit dedicato 5 tentativi/15min, audit log su `/app/data/dev_audit.log` | `routes/admin.js` (nuovo), `.env`, `server.js`, `index.html` |
| 2 | Rimosso `DEV_SECRET` hardcoded dal frontend; `showDeveloperSection()` ora chiama API server-side; `ENABLE_DEV_PANEL=false` → 404 (non rivela esistenza) | `index.html` |
| 3 | **FIX bug critico**: confronto datetime su `password_reset_tokens.expires_at` non funzionava (formato ISO vs SQLite → confronto lessicografico) → **i token reset password non scadevano mai**. Wrap con `datetime()` per confronto datetime esplicito | `routes/auth.js` |
| 4 | **Atomicità reset password**: `UPDATE users password_hash` + `UPDATE tokens used=1` ora dentro `withTransaction` → impedisce replay attack se la seconda write fallisce | `routes/auth.js` |
| 5 | `DEV_PASSWORD_HASH` e `ENABLE_DEV_PANEL` ora letti dinamicamente (lazy getter) → permette override in test / runtime senza riavvio | `routes/admin.js` |

### Validazione live
- ✅ Login admin via URL pubblico → 200
- ✅ Registrazione pubblica primo utente → role=admin (auto_promoted=true)
- ✅ Registrazione secondo utente pubblico → role=visitatore
- ✅ Admin crea sotto-utente senza privacy → inherited_privacy=true, parent_id corretto
- ✅ Sotto-utente con email + send_credentials_email → email_sent=true (SMTP Ethereal)
- ✅ PDF download `/api/reports/bilancio/:lotId` → 29.6 KB, content-type application/pdf, valido
- ✅ Server sotto supervisor → autorestart funzionante

## Test credentials
- Vedi `/app/memory/test_credentials.md`. Admin: `admin` / `96a0761f3943`.

## Backlog / Next steps

### P1 (importanti)
- [ ] CSP: rimuovere `'unsafe-inline'`/`'unsafe-eval'` (richiede refactor frontend monolitico)
- [ ] Refactor `index.html` (11k+ righe) → Vite + componenti
- [ ] HSTS in produzione
- [ ] Validazione password con zxcvbn
- [ ] Refresh token + endpoint logout
- [ ] CI con GitHub Actions
- [ ] Sostituire `console.log` residui con `logger.*` in routes minori
- [ ] CSRF protection se passi a cookie auth

### P2 (nice-to-have)
- [ ] Docker / docker-compose
- [ ] Migrazioni DB (Knex/Drizzle)
- [ ] Monitoring (Sentry / OpenTelemetry)
- [ ] TypeScript migration
- [ ] Reset password admin con UI dedicata
- [ ] Selettore tema chiaro/scuro
- [ ] Ricerca/filtri nella lista utenti

## Avvio
Server gestito da supervisor:
```bash
sudo supervisorctl status cropbook
sudo supervisorctl restart cropbook
sudo supervisorctl tail -f cropbook
```
URL pubblico: https://c95dfaa0-006a-45f3-82cf-48bf48aa2b11.preview.emergentagent.com/
