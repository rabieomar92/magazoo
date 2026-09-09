# Magazoo online projects

The browser editor remains usable without a server. `Save As…` writes a JSON file and, in a Chromium browser, keeps updating that file after it has been selected. The browser also keeps a local IndexedDB recovery copy.

The optional Node server adds the private project library at `/#admin` and share links in the form `/#edit=<token>`.

## Run it

```powershell
npm run build
$env:NODE_ENV = "production"
$env:MAGAZOO_ORIGIN = "https://magazoo.example.edu"
$env:MAGAZOO_ADMIN_PASSWORD_HASH = 'pbkdf2-sha256$...'
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

In a Hostinger Node.js Web App, upload the complete source project, including
`package.json`, `package-lock.json`, `.npmrc`, `src/`, `public/`, `server/`,
`index.html` and the TypeScript/Vite configuration files. Use the project root
(the folder containing `package.json`) as the application directory.

For admin login and online projects, select the **Other** Node.js framework
and set the entry file to `server/index.mjs`. The React/Vite static-site mode
publishes the editor but does not run this server, so its `/api/` routes will
be missing. GitHub Pages likewise serves the standalone editor only.

Deployment settings for the complete app:

| Setting | Value |
| --- | --- |
| Framework | Other (Node.js app with an entry file) |
| Node.js version | 24.x |
| Root directory | Repository root, containing `package.json` |
| Build command | `npm run build` |
| Frontend output directory | `dist` |
| Entry file | `server/index.mjs` |
| Start command, if shown | `npm start` |

Keep `server/` alongside `dist/` in the deployed application. The server entry
file is relative to the repository root, not inside `dist/`.

Use these commands:

- Install: `npm ci --include=dev`
- Build: `npm run build`
- Start: `npm start` (entry file: `server/index.mjs`)

If Hostinger provides only a build-command field and installs dependencies
automatically, use `npm ci --include=dev && npm run build` as the build command.
The built frontend lives in `dist/`; the Node server serves it and the admin
API together.

The included `.npmrc` keeps the build tools installed even when
`NODE_ENV=production`. The `NPM_CONFIG_INCLUDE` setting below also ensures this
if an upload leaves out dotfiles. Keep the production setting and select
Node.js 24.x. Add these environment variables in the Node.js app settings:

```text
NODE_ENV=production
NPM_CONFIG_INCLUDE=dev
MAGAZOO_ORIGIN=https://your-real-domain.example
HOST=0.0.0.0
MAGAZOO_ADMIN_PASSWORD_HASH=pbkdf2-sha256$...
```

`PORT` is supplied by Hostinger. The `.env` file in this project is a template;
fill its blank password-hash value and replace its example domain, or set the
same values in Hostinger’s environment-variable panel. No RSA key or
public/private key file is needed.

### Build fails with `tsc: command not found`

TypeScript and Vite are build dependencies. npm normally skips them when
`NODE_ENV=production`, so a production-only install cannot build the source.
In Hostinger, add `NPM_CONFIG_INCLUDE=dev` to the app's environment variables,
save the settings, and redeploy. This also works if the build command dropdown
only offers `npm run build`. Make sure `.npmrc` is included in future uploads.
If custom commands are available, `npm ci --include=dev && npm run build` does
the same thing explicitly. Installing only TypeScript is insufficient because
Vite and the type definitions are needed too.

References: [npm include setting](https://docs.npmjs.com/cli/v11/using-npm/config/#include)
and [Hostinger Node.js setup](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

### Admin says online projects are unavailable

Open `https://your-domain/api/auth/session` in a signed-out browser. A running
Magazoo server responds with HTTP 401 and JSON containing
`{"error":"Admin login required."}`. This is the expected signed-out response.
A hosting 404 page or the editor's HTML at that address means `/api/` is not
reaching the Node server. A 502 or 503 hosting page means the server may have
failed to start; inspect the runtime log.

In Hostinger's Settings & Redeploy, check the framework and entry file above,
keep the existing environment variables, and redeploy. The runtime log should
contain `Magazoo server ready`. A successful frontend build on its own does
not start the admin service. The public URL in `MAGAZOO_ORIGIN` must match the
site address, for example `https://magazoo.usmphysics.org` without `/#admin`.
