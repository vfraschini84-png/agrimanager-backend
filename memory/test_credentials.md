# Test credentials — AgriManager

## Super-admin (auto-creato al primo avvio)
- **Username**: `admin`
- **Email**: `admin@agrimanager.com`
- **Password**: generata casualmente al primo avvio del server e stampata in console (es. `9b73914138a1`)
  - Cercare nel log al primo boot: `🔐 NUOVO UTENTE ADMIN CREATO`
  - In sviluppo viene loggata anche su stdout, in produzione **solo nel logger Winston** con `level=warn`
- **Ruolo**: `admin` (super-admin se username === 'admin')
- ⚠️ **Cambiare la password al primo accesso**

## Utenti di test creati durante validation manuale
- `mario / password123` (operatore) — eliminato durante test cascade DELETE
- `luigi / password123` (visitatore) — visualizzazione sola lettura

## Reset password
- Endpoint: `POST /api/auth/forgot-password` con `{ email }`
- Endpoint: `POST /api/auth/reset-password` con `{ token, newPassword }`
- Token valido 1 ora
- In dev il link viene loggato in console (NODE_ENV=development), in prod **solo via email** se SMTP è configurato in `.env`

## Reset password forzato (super-admin)
- Endpoint: `POST /api/auth/admin-reset-password` con `{ userId, newPassword }` e Bearer token del super-admin
