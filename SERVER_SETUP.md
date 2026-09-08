# Magazoo online projects

The browser editor remains usable without a server. `Save As…` writes a JSON file and, in a Chromium browser, keeps updating that file after it has been selected. The browser also keeps a local IndexedDB recovery copy.

The optional Node server adds the private project library at `/#admin` and share links in the form `/#edit=<token>`.

## Run it

```powershell
npm run build
$env:MAGAZOO_ORIGIN = "https://magazoo.example.edu"
$env:MAGAZOO_ADMIN_PUBLIC_KEY = "C:\secure\magazoo-admin.pub"
npm run server
```

Put the server behind HTTPS (for example, a reverse proxy) and set `MAGAZOO_ORIGIN` to the exact public origin. The server stores its SQLite database in `.magazoo-data/`, which is excluded from source control; back up that directory securely.

## SSH-key login

`MAGAZOO_ADMIN_PUBLIC_KEY` must point to one OpenSSH RSA public-key file. The admin page creates a short-lived, origin-bound challenge. Sign the downloaded challenge on the administrator’s computer:

```text
ssh-keygen -Y sign -n magazoo-admin -f PATH_TO_RSA_PRIVATE_KEY PATH_TO/magazoo-login.txt
```

Upload only the resulting `.sig` file. The private key is never accepted by the server and never sent through the browser. The challenge is one-use and expires after two minutes; sessions are HTTP-only and protected with CSRF tokens.

## Sharing and deletion

Each JSON document gets a random, non-guessable editing token. Anyone holding that link can edit that document, so treat links like passwords. Saves use versions and reject stale writes. Deleting a project or document requires typing its exact name and immediately revokes its links.

For production use, add regular encrypted backups, rate limiting at the reverse proxy, and a second administrator key before removing the original key.
