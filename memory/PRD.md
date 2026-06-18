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

### Sessione 5 (2026-05-29 pomeriggio): refactoring Fase A — estrazione asset
| # | Modifica | File |
|---|---|---|
| 1 | **Estratto `<style>` da `index.html`** → `css/cropbook.css` (3.222 righe) | `css/cropbook.css` (nuovo) |
| 2 | **Estratto `<script>` inline da `index.html`** → `js/cropbook.js` (7.713 righe) | `js/cropbook.js` (nuovo) |
| 3 | `index.html` ridotto da 12.267 → **1.338 righe** (-89%) | `index.html` |
| 4 | `server.js`: aggiunto `express.static` su `/css` e `/js` con whitelist e blocco file sensibili (.env/.db/.sqlite → 403) | `server.js` |
| 5 | Validazione: 48/48 test Jest passano, smoke test browser → login admin OK, dashboard renderizzata, zero errori console | — |

**Vantaggi ottenuti**:
- IDE/editor performanti sull'HTML (era unusable a 12k+ righe)
- Browser fa cache separata di CSS/JS → caricamenti successivi più veloci
- Apre la strada a Fase B (split per dominio) e tightening CSP

### Sessione 6 (2026-06-03): allineamento costi economic/bilancio/PDF + UX form economico
| # | Modifica | File |
|---|---|---|
| 1 | **Form "Nuova Registrazione Economica"**: campo "Costo Personale" rinominato in "Totale Costi Stagione (€)", reso **read-only** con placeholder "Nessun costo aggiunto". Aggiornabile solo dal pulsante "Aggiorna da Costi" che ora somma personale + mezzi tecnici + ammortamenti dalla sezione Gestione Costi (3 campi nascosti separati) | `index.html`, `js/cropbook.js` |
| 2 | `salvaRegistrazioneEconomica()`: salva i 3 componenti separati nel DB (`costo_personale`, `costo_mezzi_tecnici`, `quota_ammortamento`) + `costi_totali` come somma | `js/cropbook.js` |
| 3 | **Storico registrazioni**: ogni registrazione mostra ora un blocco "💸 Dettaglio costi" con breakdown univoco (Personale / Mezzi / Ammortamenti) o "Nessun costo aggiunto". Costi e bilancio della singola riga ricalcolati al volo dai componenti (non più valore parziale stored) | `js/cropbook.js` |
| 4 | **Bilancio finale & riepilogo stagione**: ricalcolati da `costo_personale + costo_mezzi_tecnici + quota_ammortamento` per essere sempre allineati alla sezione "Gestione Costi". Aggiunto blocco "Dettaglio costi totali" con 3 card colorate (👥 Personale / 🧪 Mezzi tecnici / 📦 Ammortamenti) | `js/cropbook.js` |
| 5 | **PDF Report — fix header tabella invisibile**: testo header era posizionato a `doc.y - 12` (SOPRA il rettangolo verde) → bianco su bianco. Riposizionato a `headerY + 5` dentro la banda. Stesso fix per colonna "Costi": ricalcolata da componenti per allinearsi ai KPI totali. Filtrate registrazioni "fantasma" (ricavi=kg=0) generate dai beni durevoli | `routes/reports.js` |

### Sessione 7 (2026-06-08): nav bar inter-sezioni + storico beni durevoli
| # | Modifica | File |
|---|---|---|
| 1 | **Barra di navigazione rapida** in alto a destra in ogni sezione lotto-dipendente (Dettagli / Ricavi / Costi / Bilancio + Lista Lotti). 5 pulsanti circolari colorati (stesso stile delle action-btn della lista lotti). Mobile-responsive con 3 breakpoint (1024 / 600 / 380 px) | `index.html`, `css/cropbook.css` |
| 2 | **`navigateToSection(target, lotId)`**: helper JS che cambia sezione + sincronizza tutte le variabili `currentXxxLotId` + invoca il loader appropriato (`loadLotDetails` / `openEconomicManagement` / `loadCostiLotDetails` / `loadBilancioData`). Il lotto resta selezionato cambiando sezione e i suoi dati vengono ricaricati automaticamente | `js/cropbook.js` |
| 3 | `showSection()` ora chiama `updateSectionNavState()` che marca il pulsante della sezione corrente come `is-current` (disabilitato visivamente) | `js/cropbook.js` |
| 4 | **Storico Beni Durevoli** nella sezione "Ammortamento Beni Durevoli" di Gestione Costi: mostra TUTTI i beni mai registrati per il lotto con badge ATTIVO / TERMINATO / FUTURO calcolato dinamicamente in base alla stagione selezionata. Card compatte con descrizione, intervallo anni, quota €/anno, scadenza. Counter "X/Y attivi". Layout responsive (impilato su mobile) | `index.html`, `css/cropbook.css`, `js/cropbook.js` |

### Sessione 8 (2026-06-08 pomeriggio): fix beni durevoli (4 bug correlati)
| # | Bug | File |
|---|------|------|
| 1 | **Storico beni non si aggiornava** dopo "Salva Beni Durevoli" senza refresh pagina → aggiunto `await loadBeniDurevoliCosti()` immediatamente dopo POST | `js/cropbook.js` |
| 2 | **Record "fantasma"** dei beni durevoli appariva come riga eliminabile nello storico Gestione Economica → ora i record fantasma (ricavi=kg=0) NON sono mostrati come righe; se la stagione contiene solo fantasma, viene mostrato un messaggio informativo "Nessuna vendita registrata in questa stagione (solo quote di ammortamento — vedi Gestione Costi)". Rimosso anche il blocco inline "📦 Beni in ammortamento" dalle registrazioni di vendita (ridondante col nuovo Storico Beni in Costi). Counter registrazioni esclude i fantasma | `js/cropbook.js` |
| 3 | **"Aggiorna da Costi" → ammortamenti=0** anche con beni attivi: leggeva `r.quota_ammortamento` (campo a livello record, non popolato dal flusso beni). Ora chiama `caricaBeniDurevoliAttivi(allRecords, stagione)` e somma le quote dei beni attivi nella stagione | `js/cropbook.js` |
| 4 | **Voce "Ammortamenti" nei dettagli storico** ora visibile e allineata grazie al salvataggio corretto di `quota_ammortamento` sul record economico (fix sessione 6 + fix Bug 3) | `js/cropbook.js` |

### Sessione 9 (2026-06-08 sera): 6 ottimizzazioni UX
| # | Modifica | File |
|---|------|------|
| 1 | **Pulsante elimina bene** nello Storico Beni Registrati: icona cestino con conferma, PUT del record economico aggiornato; se il record diventa vuoto (era fantasma + niente beni) → DELETE automatico | `js/cropbook.js`, `css/cropbook.css` |
| 2 | **Layout Bilancio & Report normalizzato**: `.section` ora ha `max-width: 800px` + `margin auto` → le 3 sezioni out-of-container (lista/costi/bilancio) hanno larghezza identica alle altre. Grafici a `repeat(auto-fit, minmax(260px, 1fr))` per stackare su mobile | `css/cropbook.css`, `index.html` |
| 3 | **Registri Personale + Mezzi Tecnici (vista giornaliera)**: accordion collapsibile → solo il primo giorno espanso di default, riga compatta con counter "X att." e totale €. Click sull'header apre/chiude il dettaglio. Helper `toggleGruppoGiornaliero` | `js/cropbook.js` |
| 4 | **Rimossa sezione "Bilancio Economico" globale** dallo Storico Registrazioni Economiche (ridondante con sezione dedicata "Bilancio & Report"; il riepilogo per stagione resta dentro ogni accordion). Counter registrazioni esclude i fantasma | `index.html`, `js/cropbook.js` |
| 5 | **Bug "Tutte le stagioni" in Bilancio & Report**: gli `if (stagione)` saltavano completamente il calcolo costi personale/mezzi → solo ammortamenti. Ora se nessuna stagione è selezionata, somma su tutte le stagioni distinte presenti nei record economici (Promise.all sui fetch /costi/personale e /costi/mezzi). Test live: Ricavi €6750 / Costi €2000 (era €300) / Bilancio €4750 | `js/cropbook.js` |
| 6 | **"Calcola Auto kg" tornava 0** se l'utente non aveva ancora visitato la sezione attività di raccolta: ora legge direttamente da `localStorage[agriManager_activities_{lotId}]` come fallback quando `lotActivities` non corrisponde al lotto corrente. Aggiunto messaggio "Nessuna attività di raccolta registrata" se totale=0 | `js/cropbook.js` |

### Sessione 10 (2026-06-18): 5 nuove feature (selettore stagione, Calcola Auto, vista anno, grafico multi-stagione, PDF v2)
| # | Modifica | File |
|---|------|------|
| 1 | **Selettore stagione in Dettagli Lotto**: dropdown anno popolato da dati esistenti + ±3 anni, filtra `displayActivities()` e `displayAnalyses()` per stagione, pre-imposta data raccolta e anno analisi. Conferma utente se data attività diverge dalla stagione | `index.html`, `js/cropbook.js` |
| 2 | **Fix "Calcola Auto" kg raccolti**: la funzione effettivamente chiamata dal bottone era `calcolaKgRaccoltiAutomaticoCompleto` (non quella che avevo fixato in sessione 9). Ora legge da `localStorage[agriManager_activities_{lotId}]` come fallback quando `lotActivities` è vuoto o appartiene ad altro lotto | `js/cropbook.js` |
| 3 | **Vista "Anno"** aggiunta ai registri Personale + Mezzi Tecnici (oltre a Giorno/Settimana/Mese). Cards con totale €, conteggio attività, ore tot., €/ora media (personale) o breakdown per categoria (mezzi tecnici) | `index.html`, `js/cropbook.js` |
| 4 | **Grafico "Confronto Ultime 5 Stagioni"** in Bilancio & Report: stacked bar chart (ricavi vs costi componenti per stagione) con dati live (Promise.all su `/costi/personale` e `/costi/mezzi` per ogni stagione + quote ammortamento dai beni attivi) | `index.html`, `js/cropbook.js` |
| 5 | **PDF Report v2**: aggiunto terzo grafico full-width "Confronto Ultime 5 Stagioni" (chartjs-node-canvas) calcolato server-side da `costi_personale` + `costi_mezzi_tecnici` + `quota_ammortamento`. PDF ora 44KB / 2 pagine / 3 grafici embedded (era 29KB / 1 pagina / 2 grafici) | `routes/reports.js` |

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
