# Test credentials — AgriManager

## Super-admin (auto-creato al primo avvio)
- **Username**: `admin`
- **Email**: `admin@agrimanager.com`
- **Password attuale**: `96a0761f3943` (valida finché non viene cancellato il DB `/app/data/agrimanager.db`)
- **Ruolo**: `admin` (super-admin se username === 'admin')
- **privacy_accepted**: 1 (auto-impostato dal seed)

Per recuperare la password admin se la dimentichi:
```bash
grep "Password:" /var/log/supervisor/agrimanager.out.log | tail -1 | awk '{print $NF}'
```

## Auto-promozione primo utente
Se non ci sono altri utenti nel DB (oltre al super-admin di seed), il primo utente che si registra
pubblicamente viene **promosso automaticamente ad amministratore** dal backend, indipendentemente
dal ruolo passato nel body.

## Privacy ereditata sui sotto-utenti
Quando un utente già autenticato (`Authorization: Bearer <token>`) crea un sotto-utente via
`POST /api/auth/register`, il backend:
- imposta `parent_id` automaticamente al creatore (non falsificabile dal client)
- eredita la privacy (non serve `privacy_accepted: true` nel body)
- restituisce `inherited_privacy: true` nella risposta

## Invio credenziali via email (sotto-utenti)
Body opzionale: `send_credentials_email: true` + `email` valida.
- Funziona solo se SMTP è configurato in `www/.env` (variabili `SMTP_HOST/USER/PASS`).
- Configurazione attuale: Ethereal (sandbox di test) → email NON arrivano realmente, ma vengono
  catturate e visibili sul portale Ethereal con le credenziali della SMTP_USER.
- Per email reali in produzione, sostituire con SendGrid / Mailgun / Resend / ...

## Reset password
- `POST /api/auth/forgot-password` con `{ email }` → crea token (1h validità)
- `POST /api/auth/reset-password` con `{ token, newPassword }`
- In dev viene loggato il link, in prod inviato per email se SMTP configurato

## Reset password forzato (super-admin)
- `POST /api/auth/admin-reset-password` con `{ userId, newPassword }` + Bearer token del super-admin
