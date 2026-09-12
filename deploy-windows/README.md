# 🚀 Cropbook — Deploy Locale su Windows con Ngrok

Guida completa per far girare Cropbook sul tuo PC Windows come server permanente,
con dominio ngrok fisso, accessibile HTTPS da qualsiasi dispositivo (smartphone, tablet, altri PC).

---

## 📋 Prerequisiti

1. **Node.js 20+ LTS** installato: <https://nodejs.org/it/>
2. **Ngrok** installato: già fatto ✅
3. Repo Cropbook già clonato sul PC (in una cartella qualsiasi, es. `C:\Users\TUO_UTENTE\Cropbook`)

---

## 🔐 STEP 1 — Ottieni il tuo Authtoken Ngrok

1. Vai su <https://dashboard.ngrok.com/signup> e crea un account gratis (email + password)
2. Vai su <https://dashboard.ngrok.com/get-started/your-authtoken>
3. Copia il tuo authtoken (una stringa lunga tipo `2abc123XYZ...`)
4. Apri **PowerShell** e configura ngrok una volta sola:

   ```powershell
   ngrok config add-authtoken IL_TUO_AUTHTOKEN
   ```

---

## 🌐 STEP 2 — Crea il tuo Dominio Statico gratis

1. Vai su <https://dashboard.ngrok.com/domains>
2. Clicca **"Create Domain"** → **"Static Domain"** (gratis 1 per account)
3. Copia il dominio (es. `cropbook-mario.ngrok-free.app`)

---

## ⚙️ STEP 3 — Configura Cropbook

1. **Installa le dipendenze** (una volta sola):

   ```powershell
   cd C:\percorso\dove\hai\clonato\Cropbook\www
   npm install
   ```

2. **Modifica `www\.env`**: aggiungi il tuo dominio ngrok a `ALLOWED_ORIGINS`.
   Trova la riga `ALLOWED_ORIGINS=...` e aggiungi in coda `,https://IL_TUO_DOMINIO.ngrok-free.app`.
   Esempio:

   ```
   ALLOWED_ORIGINS=http://localhost:3000,capacitor://localhost,https://cropbook-mario.ngrok-free.app
   ```

3. **Aggiorna `PUBLIC_URL`** nella stessa `.env`:

   ```
   PUBLIC_URL=https://cropbook-mario.ngrok-free.app
   ```

4. **Crea la cartella `data\`** al livello superiore (se non esiste):

   ```powershell
   mkdir C:\percorso\dove\hai\clonato\Cropbook\data
   ```

---

## 🚀 STEP 4 — Avvio manuale (test)

Doppio-click su questi due script (uno alla volta, il secondo dopo che il primo è già in esecuzione):

1. `start-cropbook.bat`  → avvia Cropbook su `http://localhost:3000`
2. `start-ngrok.bat`     → apre il tunnel HTTPS pubblico

**Prima di lanciare** apri `start-ngrok.bat` con Blocco Note e sostituisci
`IL_TUO_DOMINIO.ngrok-free.app` con il dominio che hai copiato allo STEP 2.

Puoi già accedere all'app:
- **Dal PC locale**: <http://localhost:3000>
- **Da smartphone/altri**: <https://IL_TUO_DOMINIO.ngrok-free.app>

---

## 🔁 STEP 5 — Autostart al riavvio del PC (Task Scheduler)

**Apri PowerShell come Amministratore** (tasto destro → "Esegui come amministratore"), poi:

```powershell
cd C:\percorso\dove\hai\clonato\Cropbook\deploy-windows
.\install-autostart.ps1
```

Ti chiederà il **percorso della cartella `Cropbook`** e il tuo **dominio ngrok**. Al termine:
- 2 Task pianificati verranno creati: `Cropbook-Server` e `Cropbook-Ngrok`
- Entrambi si avviano **all'accensione del PC** (trigger "At startup") anche senza login
- Se il PC si spegne/riavvia, quando torna online **l'app è raggiungibile allo stesso URL**

Per verificare: apri `Utilità di pianificazione` (Task Scheduler) → cerca i 2 task.

Per disinstallare (rimuovere gli autostart):

```powershell
.\uninstall-autostart.ps1
```

---

## 🩺 Troubleshooting

**❌ CORS errors quando accedo via ngrok**  
Non hai aggiunto il dominio a `ALLOWED_ORIGINS` in `www\.env`. Torna allo STEP 3 punto 2.

**❌ Ngrok dice "authtoken not found"**  
Non hai configurato l'authtoken. Ripeti lo STEP 1 punto 4.

**❌ Ngrok dice "domain not reserved"**  
Non hai creato/copiato il dominio statico. Ripeti lo STEP 2.

**❌ Cropbook non parte, errore "port 3000 in use"**  
Un altro programma sta usando la porta 3000. Chiudilo o cambia la porta modificando
`PORT=3000` in `www\.env` (es. `PORT=3100`) e aggiornando `start-ngrok.bat` di conseguenza.

**❌ PWA non installabile dallo smartphone via ngrok**  
Verifica: (1) l'URL nella barra è `https://` non `http://`, (2) apri la Console del browser
mobile e vedi se ci sono errori di manifest o service worker.

**❌ Voglio vedere i log**  
Apri il file `logs\cropbook.log` e `logs\ngrok.log` nella cartella di deploy.

---

## 💡 Suggerimenti finali

- **Backup DB**: fai una copia di `data\cropbook.db` almeno una volta a settimana.
- **Non condividere il file `.env`**: contiene credenziali sensibili.
- **Se cambi PC**: riesegui questa guida sul nuovo PC. Il DB va copiato manualmente.
- **Password Dev Panel**: `Cropbook2024Dev!` (per l'area sviluppatori).
- **Super-admin di default**: username `admin`, password generata al primo avvio → guardala nei log `logs\cropbook.log` alla riga "Password:".
