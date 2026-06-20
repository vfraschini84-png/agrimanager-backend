# PRD — Cropbook

**Ultimo aggiornamento**: 2026-06-20
**Versione**: 1.8.0

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

### Sessione 11 (2026-06-18 dopo): refactor confronto multi-stagione mobile-friendly
| # | Modifica | File |
|---|------|------|
| 1 | **Sostituito stacked bar chart** (illeggibile su smartphone) con **lista di card verticali**: una card per stagione con bilancio prominente (▲verde/▼rosso), barre orizzontali proporzionali (Ricavi/Costi), chip colorati breakdown (👥 Personale, 🧪 Mezzi, 📦 Ammortamenti). Layout responsive a 3 breakpoint (default / 600px / 380px) | `index.html`, `js/cropbook.js`, `css/cropbook.css` |

### Sessione 12 (2026-06-18 sera): fix paginazione PDF Report
| # | Bug → Fix | File |
|---|------|------|
| 1 | **PDF lotto "Pozzo vivo" generava 9 pagine** con riga 2026 spaccata su 7 pagine vuote: PDFKit auto-paginava al raggiungimento del margine durante `doc.text(value, x, rowY+4)` creando una pagina per ogni cella. **Fix**: paginazione manuale con `ensureSpace(h)` PRIMA di ogni elemento (grafici e righe tabella) + funzione `drawTableHeader()` ridisegnata su ogni nuova pagina | `routes/reports.js` |
| 2 | **2 pagine vuote per il footer**: il `doc.text(footer, ..., page.height - 35)` senza `lineBreak: false` e `height: 20` faceva supporre a PDFKit che il footer occupasse spazio → addPage. Fix: parametri espliciti + `doc.flushPages()` finale | `routes/reports.js` |
| 3 | Risultato: PDF "Pozzo vivo" (3 record) ora 2 pagine pulite (era 9) con footer "pag. 1/2", "pag. 2/2"; PDF mono-stagione resta 1 pagina con 3 grafici embedded; nessun overlap di celle | — |

### Sessione 13 (2026-06-18 sera tardi): card multi-stagione nel PDF + tabella sempre su pagina nuova
| # | Modifica | File |
|---|------|------|
| 1 | **Sostituito stacked bar chart server-side** con **3 card disegnate in PDFKit** (rettangoli + barre proporzionali + badge bilancio ▲/▼). Stesso stile visivo della versione web mobile-friendly → coerenza UI/PDF | `routes/reports.js` |
| 2 | **Tabella "Registrazioni economiche" sempre su pagina nuova** (`doc.addPage()` esplicito prima del titolo) → elimina sovrapposizione testo segnalata dall'utente | `routes/reports.js` |
| 3 | Aggiunta legenda colori sotto le card (Personale arancione, Mezzi tecnici blu, Ammortamenti viola) | `routes/reports.js` |
| 4 | Verifica visiva con `pdftoppm` + `analyze_file_tool`: zero sovrapposizioni, card leggibili, layout pulito | — |

### Sessione 14 (2026-06-20): rifondazione architettura → Azienda → Lotti — FASE 1 (Backend)
**Decisioni di design** (confermate dall'utente):
- 1c: indirizzo solo sul LOTTO (`location`), azienda ha `address` opzionale come sede legale
- 2b: settori = lista multipla salvata come CSV in `companies.sectors` (un'azienda può avere vino + olio + carne)
- 3a: nuovo PDF aziendale dedicato (da implementare in FASE 3)
- 4a: anagrafica minimale (name + sectors + address opzionale)
- Migrazione automatica dei 2 lotti test esistenti → 2 aziende auto-create

| # | Modifica | File |
|---|------|------|
| 1 | **Nuova tabella `companies`**: `id, name, sectors, address, owner_id, owner_username, created_by, timestamps` + UNIQUE(owner_id, name) | `database.js` |
| 2 | **`lots.company_id`** (FK companies, ON DELETE SET NULL): aggiunto via ALTER TABLE idempotente | `database.js` |
| 3 | **Migrazione automatica al boot**: per ogni lotto con `company_id NULL` → crea/recupera azienda con stesso `company_name` + `owner_id` e collega. Test eseguito: 2 lotti → 2 aziende ✓ | `database.js` |
| 4 | **Nuovo router `routes/companies.js`**: GET (lista + lots_count), GET/:id (azienda + array lotti), POST, PUT (snapshot company_name sui lotti), DELETE (protetto se ci sono lotti). RBAC identico a lots (super-admin, admin, sotto-utente con parent_id) | `routes/companies.js` (nuovo) |
| 5 | **`routes/lots.js POST`** modificato: accetta `company_id` opzionale; se assente ma `company_name` presente → auto-crea/recupera azienda. `validateLot` ora richiede uno dei due | `routes/lots.js` |
| 6 | Endpoint registrato: `mountRoute('/api/companies', './routes/companies')` | `server.js` |

**Test backend** (tutti passano):
- GET /api/companies → 2 aziende migrate ✓
- POST /api/companies con sectors=["olio","vino"] → salvato come "olio,vino" ✓
- POST /api/lots con company_id=3 → lotto creato con company_name snapshot ✓
- POST /api/lots con company_name="nuova" → auto-crea azienda + collega ✓
- 48/48 Jest passano ✓

### FASE 2 (prossima sessione): Frontend
- Dashboard "Aziende" come homepage (sostituisce "Lista Lotti" come primo livello)
- Card per azienda → click → drill-down ai lotti
- Form registrazione lotto: select "Azienda esistente" + bottone "+ Nuova"
- Adattare nav bar inter-sezione per includere nuovo livello azienda
- Mobile-first per dashboard

### FASE 3 (sessione successiva): PDF "Bilancio Azienda"
- Endpoint `/api/reports/bilancio-azienda/:id` (somma tutti i lotti)
- Tabella confronto per lotto + grafici aggregati

### Sessione 15 (2026-06-20 pomeriggio): Frontend Aziende — FASE 2 + Report Aggregato — FASE 3
| # | Modifica | File |
|---|------|------|
| 1 | **Dashboard Aziende** (nuova sezione `#aziende-section`): grid responsive di card con nome, conteggio lotti, chip settori, sede legale, 3 pulsanti azione (👁️ Lotti / 📄 Report / ✏️ Edit). Search-bar live. Pulsante "+ Nuova Azienda" prominente. Card cliccabile → drill-down filtrato in Lista Lotti | `index.html`, `css/cropbook.css`, `js/cropbook.js` |
| 2 | **Menu home** aggiornato: nuova card "Aziende" come PRIMA voce (gradient verde, icona building) — diventa il punto di ingresso principale al posto della lista lotti | `index.html` |
| 3 | **Modal "Editor Azienda"**: form modale con nome + chip multi-settori (olivicoltura, viticoltura, frutticoltura, orticoltura, cerealicoltura, zootecnia, apicoltura, florovivaismo) + sede opzionale. Reused per crea/modifica | `index.html`, `js/cropbook.js` |
| 4 | **Form "Nuovo Lotto"** modificato: campo "Nome Azienda" sostituito con `<select>` "Seleziona azienda esistente / ➕ Nuova Azienda". Quando si sceglie "Nuova" si apre un form inline con stessi campi del modal. Backend: invia `company_id` se selezionata, altrimenti crea l'azienda inline prima del lotto | `index.html`, `js/cropbook.js` |
| 5 | **Endpoint `GET /api/reports/bilancio-azienda/:id`**: nuovo PDF aggregato per azienda con KPI totali (Ricavi/Costi/Bilancio), tabella confronto lotti (Lotto/Prodotto/Ricavi/Personale/Mezzi/Amm./Bilancio per ogni lotto + riga TOTALE evidenziata in verde). Header con settori + sede + count lotti + data | `routes/reports.js` |
| 6 | **handleSectionSpecificActions** estesa con casi `aziende-section` (loadAziendeDashboard) e `registrazione-section` (loadCompaniesIntoSelect) | `js/cropbook.js` |
| 7 | **Nav bar inter-sezione** della dashboard aziende include pulsanti per Lista Lotti + Nuovo Lotto | `index.html` |

### Sessione 16 (2026-06-20 sera): Unificazione Lista Lotti + Dashboard Aziende + Fix bug registrazione
| # | Modifica | File |
|---|------|------|
| 1 | **🐛 Fix bug registrazione lotto**: `validateLotForm()` chiamava `validateField('company-name', 2)` che falliva quando si selezionava un'azienda esistente (campo nascosto/vuoto). Ora valida `#company-select`: deve avere un valore; se `__new__` valida il nome inline | `js/cropbook.js` |
| 2 | **Lista Lotti ora include la Dashboard Aziende** come vista di default. Toggle "📋 Per Azienda" / "📋 Tutti i lotti" + pulsante "+ Nuova Azienda" sempre visibile. Click "Lotti" su una card → drill-down ai lotti di quell'azienda con pulsante "← Torna alle aziende" | `index.html`, `js/cropbook.js` |
| 3 | **Card aziende semplificate**: rimosso il pulsante "Report PDF" (sarà nella sezione Bilancio & Report). Restano solo "👁️ Lotti" e "✏️ Modifica" come richiesto | `js/cropbook.js` |
| 4 | **Rimossa sezione separata `#aziende-section`** (ora unificata in `lista-section`). Rimossa voce "Aziende" dal menu home. Modal editor azienda spostato fuori dalla sezione (globale) | `index.html`, `js/cropbook.js` |
| 5 | Variabili globali `currentVistaLotti` + `currentAziendaFilter` per memorizzare lo stato della vista tra navigazioni | `js/cropbook.js` |

### Stato delle 4 richieste utente

| # | Richiesta | Stato |
|---|-----------|-------|
| 1 | Card aziende dentro Lista Lotti con solo "Lotti" + "Modifica" | ✅ Completato |
| 2 | Selettore Azienda→Lotto nelle altre sezioni (Dettagli/Costi/Bilancio) per cambio lotto | 🟡 Backlog prossima sessione |
| 3 | Bug registrazione lotto risolto | ✅ Completato |
| 4 | Bilancio & Report con vista per azienda + report stagione totale + dettaglio lotti | 🟡 Backlog prossima sessione |

### Sessione 17 (2026-06-20 tarda sera): Fix RBAC azienda altrui in registrazione lotto
| # | Bug → Fix | File |
|---|------|------|
| 1 | **🐛 "Azienda non valida o non autorizzata"** quando super-admin selezionava azienda di un sotto-utente (es. admin vuole creare lotto per "Pozzo vivo" che ha `owner_id=2`, non `owner_id=1` dell'admin). Backend cercava sempre `WHERE owner_id = finalOwnerId` rifiutando il match. **Fix**: se `req.user.username === 'admin'` (super-admin) cerca solo per `WHERE id = ?` (ignora owner) e usa il tenant dell'azienda per il nuovo lotto (override `owner_id` + `owner_username`) | `routes/lots.js` |

**Verifica end-to-end** (super-admin crea lotto per azienda "Pozzo vivo" owner_id=2):
- POST /api/lots → 201 ✓
- Lotto creato con `owner_id=2` (NON owner_id=1 dell'admin) ✓
- Azienda "Pozzo vivo" ora mostra 2 lotti correttamente ✓
- Toast UI "✅ Lotto creato con ID: 7" visibile, form resettato ✓
- 48/48 test Jest passano ✓
- RBAC preservato: utenti non-admin restano vincolati al proprio tenant ✓

### Sessione 18 (2026-06-20 notte): Fix isolamento aziende — lotti non si mescolano più
| # | Bug → Fix | File |
|---|------|------|
| 1 | **🐛 Lotti di azienda B visibili in elenco azienda A**: il drill-down "Lotti" usava `search.value = nome_azienda` con matching parziale (es. "Pozzo" matcha anche "Pozzo Profondo" o un lotto con location "Pozzo"). **Fix**: filtro STRICT per `company_id` (campo univoco) in `filterLots()` e `loadLots()`; rimosso il pre-fill della search bar | `js/cropbook.js` |
| 2 | **`displayLots()` rispetta `currentAziendaFilter`** dal primo render — non più solo dopo l'input nella search | `js/cropbook.js` |
| 3 | **Banner "🏢 Azienda: X" nella vista lotti** per chiarezza visiva | `index.html`, `js/cropbook.js` |
| 4 | Verifica dipendenze aggregati: tutti gli endpoint costi/economic/report usano `WHERE lot_id = ?` (univoco); `companies/:id` e `reports/bilancio-azienda/:id` usano `WHERE company_id = ?` (univoco). **Nessun rischio di contaminazione tra aziende** | — |

**Verifica E2E**:
- Creati 3 lotti per Pozzo vivo (id 1, 8, 11) + 2 lotti per Demo PDF Final (id 2, 10)
- Vista "Pozzo vivo" → mostra ESATTAMENTE 3 lotti, nessun lotto Demo ✓
- API `/companies/1` → 3 lotti (di Pozzo); `/companies/2` → 2 lotti (di Demo) ✓
- PDF bilancio-azienda/1 (Pozzo) → totale €6500 ricavi su 3 lotti; PDF bilancio-azienda/2 (Demo) → solo Demo ✓
- 48/48 test Jest passano ✓
- Screenshot live: banner "Azienda: Pozzo vivo" + 3 card lotti Pozzo, nessuna contaminazione ✓

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

### Sessione 5 (2026-06-20): Cascade Azienda→Lotto + Vista Bilancio per Azienda
| # | Modifica | File |
|---|---|---|
| 1 | **Cascade selectors Azienda→Lotto**: aggiunto un `<select id="cascade-az-{ctx}">` accanto a ogni dropdown lotti nelle 4 sezioni (`dettagli-section`, `gestione-economica-section`, `gestione-costi-section`, `bilancio-section`). State globale `cascadeCompanyFilter` per contesto. Filtra `allLots` per `company_id` quando l'utente seleziona un'azienda. | `index.html`, `js/cropbook.js` |
| 2 | **Vista Bilancio "Per Azienda"** (nuova default): toggle `[Vista Aziende] [Vista Singolo Lotto]` in `#bilancio-section`. La modalità "Aziende" mostra una griglia di card per ogni azienda con lotti → drill-down con 4 KPI aggregati (Ricavi, Costi, Bilancio, N° Lotti) + tabella confronto lotti con riga TOTALE. La modalità "Singolo Lotto" è la classica vista esistente. | `index.html`, `js/cropbook.js` |
| 3 | **PDF Bilancio Azienda dal drill-down**: pulsante `bilancio-azienda-pdf-btn` chiama `/api/reports/bilancio-azienda/:id` (già esistente) e scarica il PDF aggregato per l'azienda corrente. | `js/cropbook.js` |
| 4 | **Funzione `aggregaCostiERicaviLotto(lotId)`**: helper client-side che aggrega ricavi, costi personale, mezzi tecnici e ammortamenti su tutte le stagioni di un lotto. Riutilizzata per generare i KPI aziendali. | `js/cropbook.js` |
| 5 | **Helper unificato**: `getLotsByCascadeContext(ctx)`, `popolaSelectAziendeCascade(ctx)`, `onCambioAziendaCascade(ctx)`. Le 4 funzioni `populateDropdownMenu`/`populateEconomicDropdownMenu`/`initGestioneCosti`/`initBilancioSection` ora filtrano via cascade-state. | `js/cropbook.js` |
| 6 | **Pulizia**: rimosse `setupCascadeSelector`/`refreshCascadeLots` legacy (non più necessarie). | `js/cropbook.js` |

**Test**: 48/48 Jest + 9/9 pytest (testing agent v3) + UI Playwright PASS. Tutti i selettori, drill-down e PDF verificati end-to-end.

### Sessione 6 (2026-06-20): Ottimizzazione PDF + analisi dettagliate
| # | Modifica | File |
|---|---|---|
| 1 | **PDF `bilancio-azienda` ottimizzato**: rimosse query N+1 (era 1 SELECT + 3 query per lotto, ora 4 SELECT bulk con `WHERE lot_id IN (...) GROUP BY lot_id` indipendentemente dal numero di lotti). Aggiunto query string `?stagione=YYYY` che filtra ricavi/personale/mezzi/ammortamenti. | `routes/reports.js` |
| 2 | **Stagione di riferimento** nel PDF aziendale (header): mostra "Stagione di riferimento: YYYY" o "Periodo: Tutte le stagioni". Filename del PDF include la stagione (`bilancio-azienda-Nome_YYYY.pdf`). | `routes/reports.js` |
| 3 | **Selettore stagione drill-down**: `<select id="bilancio-azienda-stagione">` popolato dalle stagioni reali dei record economici dei lotti dell'azienda. Filtra KPI, tabella e PDF. | `index.html`, `js/cropbook.js` |
| 4 | **FIX bug critico**: "Confronto Ultime 5 Stagioni" nel PDF singolo lotto mostrava sempre Personale=0 e Mezzi=0 (la query usava `WHERE stagione = ?` invece di `stagione_agricola = ?`, l'errore veniva ingoiato dal `.catch(()=>null)`). Ora usa una bulk GROUP BY su `stagione_agricola` e match perfetto con i numeri della dashboard. | `routes/reports.js` |
| 5 | **FIX ammortamenti incoerenti**: il PDF sommava `quota_ammortamento` dai record economici, la dashboard usava la finestra di attivazione dei beni durevoli (`anno_inizio` + `anni_ammortamento`). Aggiunto helper server-side `estraiBeniAttivi()` che replica esattamente la logica del frontend. Anche i totali principali del PDF ora usano la stessa fonte. | `routes/reports.js` |
| 6 | **3 nuove sezioni dettagliate nel PDF singolo lotto**: ognuna su pagina dedicata, banner colorato + sottotitolo + grafico a barre orizzontale (Chart.js) + tabella con riga TOTALE e colonna **Incidenza %**. <br>• **Costi Personale per Attività** (gruppo `attivita` + `qualifica` da `costi_personale`) con colonne Interventi, Ore-uomo, Totale, Incidenza. <br>• **Mezzi Tecnici per Categoria** (`categoria` da `costi_mezzi_tecnici`) + tabella secondaria top-10 per descrizione. <br>• **Ammortamenti per Bene Durevole** (parsed da `beni_durevoli` JSON, deduplica per chiave) con Costo, Anni, Quota/anno, Anni nel periodo, Totale, Incidenza. | `routes/reports.js` |
| 7 | **Helper `aggregaAmmortamentiPerBene(records, anniFiltro)`** server-side: somma quota annuale × anni in cui il bene è attivo. | `routes/reports.js` |
| 8 | **Rimossi emoji** dal PDF aziendale (PDFKit Helvetica non li renderizza, si vedevano caratteri tipo `Ø=ÜA`). | `routes/reports.js` |

**Test**: 48/48 Jest + 15/15 pytest (iteration_2) + UI Playwright PASS. Analisi PDF (Gemini) conferma tutte le 3 sezioni con grafico+tabella+Incidenza.

## Backlog / Next steps

### P1 (importanti)
- [ ] **Modularizzare `js/cropbook.js`** (~9.1k righe): split in moduli ES per dominio (auth, lots, cascade, bilancio, charts, pdf-export). Aumenta manutenibilità e riduce rischio regressione.
- [ ] **Notifiche email automatiche** (agenda agricola): promemoria attività + alert rese basse via SMTP esistente.
- [ ] CSP: rimuovere `'unsafe-inline'`/`'unsafe-eval'` (ora che CSS/JS sono estratti)
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
