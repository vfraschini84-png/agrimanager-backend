# Test credentials — AgriManager

## ⚠️ ATTENZIONE
Le credenziali admin vengono **rigenerate automaticamente** ad ogni reset del DB (cancellazione di `/app/data/agrimanager.db`). La password viene stampata nel log al primo avvio.

## Super-admin corrente
- **Username**: `admin`
- **Email**: `admin@agrimanager.com`
- **Password attuale**: `14faa1dc30d2` (valida finché non viene cancellato il DB)
- **Ruolo**: `admin`
- `privacy_accepted = 1` (auto-impostato dal seed)

Per recuperare la password admin se la dimentichi:
```bash
grep "Password:" /tmp/agri.log | tail -1 | awk '{print $NF}'
```

## Sotto-utenti di test creati
- `mario_op` (operatore, parent=admin) — può creare/modificare lotti
- `operatore1` (operatore, parent=admin)

## Reset password
- Endpoint: `POST /api/auth/forgot-password` con `{ email }`
- Endpoint: `POST /api/auth/reset-password` con `{ token, newPassword }`
- Token valido 1 ora
- In dev (NODE_ENV=development) il link viene loggato in console
- In prod, mail vera se SMTP è configurato in `.env`

## Reset password forzato (super-admin)
- Endpoint: `POST /api/auth/admin-reset-password` con `{ userId, newPassword }` e Bearer token del super-admin

## Privacy ereditata
Quando un utente autenticato (con privacy già accettata) crea un sotto-utente via `POST /api/auth/register`, la privacy viene **ereditata automaticamente** — il sotto-utente non deve accettare di nuovo l'informativa. Vale solo se viene fornito `Authorization: Bearer <token>` valido nella richiesta. Se il token manca o è invalido, la registrazione è considerata "pubblica" e `privacy_accepted: true` resta obbligatorio.
