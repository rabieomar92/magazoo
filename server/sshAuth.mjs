import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { token } from './storage.mjs';

export const NAMESPACE='magazoo-admin';
/** Verify an OpenSSH signature of an origin-bound, single-use challenge.
 * The website receives only public keys (configured by the operator) and
 * signatures. It has no endpoint for accepting private keys. */
export async function verifySshSignature(message,signature,publicKeyFile) {
  const key=(await readFile(publicKeyFile,'utf8')).trim();
  if(!/^ssh-rsa [A-Za-z0-9+/=]+(?:\s[^\r\n]*)?$/.test(key)) throw new Error('Configure one OpenSSH RSA public key (.pub).');
  const temp=await mkdtemp(join(tmpdir(),'magazoo-signature-'));
  try {
    await writeFile(join(temp,'allowed'),`admin namespaces="${NAMESPACE}" ${key}\n`,{mode:0o600});
    await writeFile(join(temp,'signature'),signature,{mode:0o600});
    return await new Promise((resolve)=>{
      const child=spawn('ssh-keygen',['-Y','verify','-f',join(temp,'allowed'),'-I','admin','-n',NAMESPACE,'-s',join(temp,'signature')],{stdio:['pipe','ignore','ignore'],windowsHide:true});
      const timer=setTimeout(()=>child.kill(),5000);
      child.on('error',()=>{clearTimeout(timer);resolve(false);});
      child.on('close',code=>{clearTimeout(timer);resolve(code===0);});
      child.stdin.on('error',()=>{});child.stdin.end(message);
    });
  } finally { await rm(temp,{recursive:true,force:true}); }
}
export function createAuth({origin,publicKeyFile,verify=verifySshSignature,now=Date.now}) {
  const challenges=new Map(),sessions=new Map(),attempts=new Map();
  const prune=()=>{for(const map of [challenges,sessions,attempts])for(const[id,item]of map)if(item.expires<now())map.delete(id);};
  const timer=setInterval(prune,60000);timer.unref();
  return {
    close(){clearInterval(timer);},
    challenge(ip){
      prune();if(!publicKeyFile)throw Object.assign(new Error('Admin login is not configured. Ask the server operator to set MAGAZOO_ADMIN_PUBLIC_KEY.'),{status:503});
      const rate=attempts.get(ip)??{count:0,expires:now()+600000};rate.count++;attempts.set(ip,rate);
      if(rate.count>20 || challenges.size>200)throw Object.assign(new Error('Too many login attempts. Try again later.'),{status:429});
      const id=token(),expires=now()+120000;
      // No trailing newline: download these exact bytes; shell echo changes them.
      const message=`Magazoo admin login\nOrigin: ${origin}\nChallenge: ${id}\nExpires: ${new Date(expires).toISOString()}`;
      const binding=token();challenges.set(id,{message,binding,expires});return{id,message,expires,binding};
    },
    async login(id,signature,binding){
      const item=challenges.get(id);challenges.delete(id);
      if(!item || item.expires<now() || !binding || item.binding!==binding || !await verify(item.message,signature,publicKeyFile))return null;
      const secret=token(),csrf=token();sessions.set(secret,{csrf,expires:now()+8*3600000});return{secret,csrf};
    },
    session(secret){const item=sessions.get(secret);return item && item.expires>=now() ? item:null;},
    logout(secret){sessions.delete(secret);},
  };
}
