import { mkdir } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { openStorage } from './storage.mjs';
import { createApp } from './app.mjs';
// Load the deployment file only in production. Local development keeps using
// explicit PowerShell variables, so a Hostinger .env cannot accidentally
// change a developer's local origin or port.
if (process.env.NODE_ENV === 'production') {
  try { loadEnvFile(); } catch { /* .env is optional; Hostinger may provide variables directly. */ }
}
const dir=resolve(process.env.MAGAZOO_DATA_DIR??'.magazoo-data');
await mkdir(dir,{recursive:true,mode:0o700});
const storage=openStorage(resolve(dir,'projects.sqlite'));
const origin=process.env.MAGAZOO_ORIGIN??'http://127.0.0.1:8787';
const server=createApp({storage,origin,passwordHash:process.env.MAGAZOO_ADMIN_PASSWORD_HASH,staticDir:resolve('dist')});
server.listen(Number(process.env.PORT??8787),process.env.HOST??'127.0.0.1',()=>console.log(`Magazoo server ready at ${origin}. Admin: ${origin}/#admin`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{storage.close();process.exit(0);}));
