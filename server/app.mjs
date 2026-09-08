import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createAuth } from './passwordAuth.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const MAX_BODY=64*1024*1024;
async function body(req,limit=MAX_BODY) {
  if(Number(req.headers['content-length'])>limit)fail(413,'Project exceeds the 64 MB upload limit.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>limit)fail(413,'Request is too large.');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'Invalid JSON.');}
}
function projectName(value,extension=false){
  if(typeof value!=='string')fail(400,'A name is required.');
  const name=value.trim();
  if(!name || name.length>120 || Array.from(name).some(c=>c.charCodeAt(0)<32) || /[<>:"/\\|?*]/.test(name) || /^\.+$/.test(name))fail(400,'Use a name of 1–120 characters without path or control characters.');
  return extension && !name.toLowerCase().endsWith('.json') ? `${name}.json`:name;
}
export function validateDoc(doc){
  if(!doc || doc.schemaVersion!==1 || !doc.meta || typeof doc.meta.title!=='string' || !Array.isArray(doc.blocks) || !doc.design || !doc.assets || typeof doc.assets!=='object')fail(400,'Upload a valid Magazoo project JSON.');
  return JSON.stringify(doc);
}
const cookies=req=>Object.fromEntries((req.headers.cookie??'').split(';').map(v=>{const i=v.indexOf('=');return[v.slice(0,i).trim(),v.slice(i+1).trim()];}));
export function createApp({storage,origin,passwordHash,staticDir,authOptions={}}){
  const url=new URL(origin);
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:' && !local)throw new Error('Online projects require an HTTPS origin.');
  const rootPath=url.pathname.replace(/\/$/,'');
  const secure=url.protocol==='https:';
  const auth=createAuth({passwordHash,...authOptions});
  const cookie=(name,value,age)=>`${name}=${value}; HttpOnly; SameSite=Strict; Path=${rootPath||'/'}; Max-Age=${age}${secure?'; Secure':''}`;
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try {
      const pathname=new URL(req.url,origin).pathname;
      if(rootPath && !pathname.startsWith(`${rootPath}/`))return send(404,{error:'Not found'});
      const path=pathname.slice(rootPath.length);
      if(!path.startsWith('/api/')){
        if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed.');
        if(!staticDir)fail(404,'Start the editor development server, or run npm run build.');
        const dist=resolve(staticDir);let file=resolve(dist,`.${decodeURIComponent(path)}`);
        if(!file.startsWith(`${dist}${sep}`) && file!==dist)fail(404,'Not found.');
        if(path==='/' || path==='/index.html')file=resolve(dist,'index.html');
        if(!(await stat(file).catch(()=>null))?.isFile())fail(404,'Not found.');
        const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.otf':'font/otf','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
        res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(req.method==='HEAD'?undefined:await readFile(file));return;
      }
      if(!['GET','HEAD'].includes(req.method) && req.headers.origin!==url.origin)fail(403,'Origin not allowed.');
      if(req.headers.origin && req.headers.origin!==url.origin)fail(403,'Origin not allowed.');
      const jar=cookies(req);
      if(path==='/api/auth/login' && req.method==='POST'){
        const data=await body(req,4096);
        if(typeof data.password!=='string'||data.password.length<1||data.password.length>512)fail(400,'Enter your admin password.');
        const session=await auth.login(data.password,req.socket.remoteAddress??'unknown');
        if(!session)fail(401,'Incorrect admin password.');
        res.setHeader('Set-Cookie',cookie('magazoo_admin',session.secret,8*3600));return send(200,{csrf:session.csrf});
      }
      // Sharing tokens grant access to this one document, never admin routes.
      if(path==='/api/documents/shared'){
        const secret=req.headers.authorization?.match(/^Bearer ([\w-]{43})$/)?.[1];
        const item=secret && storage.read(secret);if(!item)fail(404,'Document not found or link revoked.');
        if(req.method==='GET')return send(200,{name:item.name,version:item.version,doc:JSON.parse(item.body)});
        if(req.method==='PUT'){
          const version=Number(req.headers['if-match']);if(!Number.isSafeInteger(version)||version<1)fail(428,'A document version is required.');
          const json=validateDoc(await body(req));
          if(!storage.update(secret,version,json))fail(409,'A newer version exists. Your changes were not written.');
          return send(200,{version:version+1});
        }
        fail(405,'Method not allowed.');
      }
      const session=auth.session(jar.magazoo_admin);if(!session)fail(401,'Admin login required.');
      if(req.method!=='GET' && req.headers['x-csrf-token']!==session.csrf)fail(403,'Reload the admin page and try again.');
      if(path==='/api/auth/session' && req.method==='GET')return send(200,{csrf:session.csrf});
      if(path==='/api/auth/logout' && req.method==='POST'){auth.logout(jar.magazoo_admin);res.setHeader('Set-Cookie',cookie('magazoo_admin','',0));return send(200,{ok:true});}
      if(path==='/api/projects' && req.method==='GET')return send(200,storage.list());
      if(path==='/api/projects' && req.method==='POST'){const data=await body(req,4096);return send(201,storage.createProject(projectName(data.name)));}
      const project=path.match(/^\/api\/projects\/([\w-]+)$/);
      if(project && req.method==='DELETE'){const data=await body(req,4096);if(!storage.removeProject(project[1],data.confirmation))fail(400,'Type the exact project name to confirm deletion.');return send(200,{ok:true});}
      const items=path.match(/^\/api\/projects\/([\w-]+)\/documents$/);
      if(items && req.method==='POST'){const data=await body(req);return send(201,storage.createDocument(items[1],projectName(data.name,true),validateDoc(data.doc)));}
      const item=path.match(/^\/api\/documents\/([\w-]+)$/);
      if(item && req.method==='DELETE'){const data=await body(req,4096);if(!storage.removeDocument(item[1],data.confirmation))fail(400,'Type the exact file name to confirm deletion.');return send(200,{ok:true});}
      fail(404,'Not found.');
    } catch(error){
      if(res.headersSent){res.end();return;}
      const conflict=String(error.message).includes('UNIQUE constraint');
      const status=error.status??(conflict?409:500);
      send(status,{error:status===500?'Unable to complete the request. Check server configuration.':conflict?'That name is already used. Choose a different name.':error.message});
    }
  });
  server.on('close',()=>auth.close());
  server.requestTimeout=30000;server.headersTimeout=15000;
  return server;
}
