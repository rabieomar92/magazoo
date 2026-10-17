import {test} from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApp} from './app.mjs';import {openStorage} from './storage.mjs';import {hashPassword,verifyPassword} from './passwordAuth.mjs';
const old='correct horse battery staple',next='A different long passphrase for testing only';
test('password change requires current credentials, CSRF and origin; rotates sessions and preserves articles',async t=>{
  const storage=openStorage(':memory:'),server=createApp({storage,origin:'http://127.0.0.1',passwordHash:hashPassword(old)});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(()=>{storage.close();r();})));
  const endpoint=`http://127.0.0.1:${server.address().port}/api/`;
  const request=(path,data,headers={})=>fetch(endpoint+path,{method:data?'POST':'GET',headers:{Origin:'http://127.0.0.1','Content-Type':'application/json',...headers},body:data?JSON.stringify(data):undefined});
  const signIn=async password=>{const response=await request('auth/login',{password});return {response,cookie:response.headers.getSetCookie()[0]?.split(';')[0],data:await response.json()};};
  const first=await signIn(old),second=await signIn(old),headers={Cookie:first.cookie,'X-CSRF-Token':first.data.csrf};
  const project=storage.createProject('Keep me'),body=JSON.stringify({schemaVersion:1,meta:{title:'Exact'},design:{},blocks:[],assets:{}}),item=storage.createDocument(project.id,'exact.json',body);
  const data={currentPassword:old,newPassword:next,confirmation:next};
  assert.equal((await request('auth/password',data)).status,401);
  assert.equal((await request('auth/password',data,{Cookie:first.cookie})).status,403);
  assert.equal((await request('auth/password',data,{...headers,Origin:'https://evil.example'})).status,403);
  for(const patch of [{newPassword:'short',confirmation:'short'},{confirmation:'different'},{currentPassword:'wrong'},{newPassword:old,confirmation:old}])assert.notEqual((await request('auth/password',{...data,...patch},headers)).status,200);
  assert.equal(storage.adminPasswordHash(),undefined);
  const changed=await request('auth/password',data,headers);assert.equal(changed.status,200);
  const renewed=await changed.json(),cookie=changed.headers.getSetCookie()[0].split(';')[0];assert.notEqual(cookie,first.cookie);assert.notEqual(renewed.csrf,first.data.csrf);
  assert.equal((await request('auth/session',undefined,{Cookie:first.cookie})).status,401);
  assert.equal((await request('auth/session',undefined,{Cookie:second.cookie})).status,401);
  assert.equal((await request('auth/session',undefined,{Cookie:cookie})).status,200);
  assert.equal((await signIn(old)).response.status,401);assert.equal((await signIn(next)).response.status,200);
  assert.equal(storage.read(item.token).body,body);assert.equal(verifyPassword(next,storage.adminPasswordHash()),true);
});
test('stored password survives database reopen and atomic stale changes cannot overwrite it',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'magazoo-password-test-')),path=join(dir,'test.sqlite');let storage=openStorage(path);
  try{const hash=hashPassword(next);assert.equal(storage.changeAdminPasswordHash(undefined,hash),true);assert.equal(storage.changeAdminPasswordHash(undefined,hashPassword(old)),false);storage.close();storage=openStorage(path);assert.equal(verifyPassword(next,storage.adminPasswordHash()),true);}
  finally{storage.close();await rm(dir,{recursive:true,force:true});}
});
