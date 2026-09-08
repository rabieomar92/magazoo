# Magazoo online projects

The browser editor remains usable without a server. `Save As…` writes a JSON file and, in a Chromium browser, keeps updating that file after it has been selected. The browser also keeps a local IndexedDB recovery copy.

The optional Node server adds the private project library at `/#admin` and share links in the form `/#edit=<token>`.

## Run it

```powershell
npm run build
$env:NODE_ENV = "production"
$env:MAGAZOO_ORIGIN = "https://magazoo.example.edu"
$env:MAGAZOO_ADMIN_PASSWORD_HASH = "pbkdf2-sha256$..."
$env:HOST = "0.0.0.0"
npm run server
```

Put the server behind HTTPS (for example, a reverse proxy) and set `MAGAZOO_ORIGIN` to the exact public origin. The server stores its SQLite database in `.magazoo-data/`, which is excluded from source control; back up that directory securely.

## Password login

The server stores only a salted PBKDF2-SHA-256 password verifier in
`MAGAZOO_ADMIN_PASSWORD_HASH`. Generate one locally and paste the complete
line into Hostinger’s environment-variable settings (or the production `.env`):

```powershell
npm run hash-password
```

The password itself is never written to the project. Login sessions are
HTTP-only, expire after eight hours, and are protected with CSRF tokens. Failed
logins are throttled per client address.

## Sharing and deletion

Each JSON document gets a random, non-guessable editing token. Anyone holding that link can edit that document, so treat links like passwords. Saves use versions and reject stale writes. Deleting a project or document requires typing its exact name and immediately revokes its links.

For production use, add regular encrypted backups, rate limiting at the reverse proxy, and a documented password-rotation procedure.

## Hostinger checklist

In a Hostinger Node.js Web App, upload the project, install dependencies, build
the client, and start the app with `npm run start` (entry file:
`server/index.mjs`). Add these environment variables in the Node.js app
settings:

```text
NODE_ENV=production
MAGAZOO_ORIGIN=https://your-real-domain.example
HOST=0.0.0.0
MAGAZOO_ADMIN_PASSWORD_HASH=pbkdf2-sha256$...
```

`PORT` is supplied by Hostinger. The `.env` file in this project is a template;
fill its blank password-hash value and replace its example domain, or set the
same values in Hostinger’s environment-variable panel. No RSA key or
public/private key file is needed.
