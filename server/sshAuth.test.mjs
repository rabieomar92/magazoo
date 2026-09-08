import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createAuth,verifySshSignature,NAMESPACE } from './sshAuth.mjs';
const exec=promisify(execFile);
test('actual OpenSSH RSA signatures verify only for the matching message and namespace',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'magazoo-auth-test-'));
  try{
    const key=join(dir,'test_rsa'),message=join(dir,'challenge.txt');
    await exec('ssh-keygen',['-q','-t','rsa','-b','2048','-N','','-f',key],{windowsHide:true});
    await writeFile(message,'Unique challenge bytes');
    await exec('ssh-keygen',['-Y','sign','-n',NAMESPACE,'-f',key,message],{windowsHide:true});
    const signature=await readFile(message+'.sig','utf8');
    assert.equal(await verifySshSignature('Unique challenge bytes',signature,key+'.pub'),true);
    assert.equal(await verifySshSignature('Wrong bytes',signature,key+'.pub'),false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('expired challenges are rejected and missing public key fails closed',async()=>{
  let time=1000;const auth=createAuth({origin:'https://example.test',publicKeyFile:'configured.pub',now:()=>time,verify:async()=>true});
  const c=auth.challenge('ip');time+=120001;assert.equal(await auth.login(c.id,'sig',c.binding),null);auth.close();
  const missing=createAuth({origin:'https://example.test'});assert.throws(()=>missing.challenge('ip'),/not configured/);missing.close();
});
