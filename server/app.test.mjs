import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openStorage } from './storage.mjs';
import { createApp } from './app.mjs';
const doc={schemaVersion:1,meta:{title:'Test document'},blocks:[],design:{},assets:{}};
async function fixture(t){
  const storage=openStorage(':memory:');
  const server=createApp({storage,origin:'http://127.0.0.1',publicKeyFile:'test.pub',authOptions:{verify:async(_,signature)=>signature==='-----BEGIN SSH SIGNATURE-----valid'}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(()=>{storage.close();resolve();})));
  const endpoint=`http://127.0.0.1:${server.address().port}/api/`;
  const request=(path,{method='GET',data,headers={}}={})=>fetch(endpoint+path,{method,headers:{Origin:'http://127.0.0.1','Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)});
  const challenge=await request('auth/challenge',{method:'POST'});const binding=challenge.headers.getSetCookie()[0].split(';')[0];const payload=await challenge.json();
  const logged=await request('auth/login',{method:'POST',data:{id:payload.id,signature:'-----BEGIN SSH SIGNATURE-----valid'},headers:{Cookie:binding}});
  const cookie=logged.headers.getSetCookie()[0].split(';')[0];const {csrf}=await logged.json();
  const admin=(path,options={})=>request(path,{...options,headers:{Cookie:cookie,'X-CSRF-Token':csrf,...options.headers}});
  return{storage,request,admin,cookie,csrf,payload,binding};
}
test('key challenge is browser-bound, one-use; admin session and CSRF are required',async t=>{
  const{request,admin,payload,binding,cookie}=await fixture(t);
  assert.equal((await request('projects')).status,401);
  assert.equal((await request('projects',{method:'POST',data:{name:'X'},headers:{Cookie:cookie}})).status,403);
  assert.equal((await admin('projects',{method:'POST',data:{name:'X'},headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await request('auth/login',{method:'POST',data:{id:payload.id,signature:'-----BEGIN SSH SIGNATURE-----valid'},headers:{Cookie:binding}})).status,401);
  const fresh=await(await request('auth/challenge',{method:'POST'})).json();
  assert.equal((await request('auth/login',{method:'POST',data:{id:fresh.id,signature:'-----BEGIN SSH SIGNATURE-----valid'}})).status,401);
});
test('projects group documents; shared links edit only one JSON with version protection',async t=>{
  const{request,admin}=await fixture(t);
  const project=await(await admin('projects',{method:'POST',data:{name:'September'}})).json();
  const item=await(await admin(`projects/${project.id}/documents`,{method:'POST',data:{name:'one',doc}})).json();
  const headers={Authorization:`Bearer ${item.token}`};
  assert.equal(item.token.length,43);
  assert.equal((await request('projects',{headers})).status,401);
  assert.equal((await request('documents/shared',{headers:{Authorization:`Bearer ${'x'.repeat(43)}`}})).status,404);
  const initial=await(await request('documents/shared',{headers})).json();assert.equal(initial.name,'one.json');
  assert.equal((await request('documents/shared',{method:'PUT',data:doc,headers})).status,428);
  const updated=await request('documents/shared',{method:'PUT',data:{...doc,meta:{title:'Changed'}},headers:{...headers,'If-Match':'1'}});assert.equal(updated.status,200);
  assert.equal((await updated.json()).version,2);
  assert.equal((await request('documents/shared',{method:'PUT',data:doc,headers:{...headers,'If-Match':'1'}})).status,409);
  assert.equal((await(await request('documents/shared',{headers})).json()).doc.meta.title,'Changed');
  const listed=await(await admin('projects')).json();assert.equal(listed[0].items[0].token,item.token);
});
test('deletion requires exact names and invalidates document links',async t=>{
  const{request,admin}=await fixture(t);
  const p=await(await admin('projects',{method:'POST',data:{name:'Safe project'}})).json();
  const item=await(await admin(`projects/${p.id}/documents`,{method:'POST',data:{name:'keep.json',doc}})).json();
  assert.equal((await admin(`documents/${item.id}`,{method:'DELETE',data:{confirmation:'keep'}})).status,400);
  assert.equal((await admin(`projects/${p.id}`,{method:'DELETE',data:{confirmation:'safe project'}})).status,400);
  assert.equal((await admin(`documents/${item.id}`,{method:'DELETE',data:{confirmation:'keep.json'}})).status,200);
  assert.equal((await request('documents/shared',{headers:{Authorization:`Bearer ${item.token}`}})).status,404);
  const item2=await(await admin(`projects/${p.id}/documents`,{method:'POST',data:{name:'two.json',doc}})).json();
  assert.equal((await admin(`projects/${p.id}`,{method:'DELETE',data:{confirmation:'Safe project'}})).status,200);
  assert.equal((await request('documents/shared',{headers:{Authorization:`Bearer ${item2.token}`}})).status,404);
});
test('invalid documents, path-like names and duplicate names are rejected',async t=>{
  const{admin}=await fixture(t);
  assert.equal((await admin('projects',{method:'POST',data:{name:'../escape'}})).status,400);
  const p=await(await admin('projects',{method:'POST',data:{name:'Unique'}})).json();
  assert.equal((await admin('projects',{method:'POST',data:{name:'Unique'}})).status,409);
  assert.equal((await admin(`projects/${p.id}/documents`,{method:'POST',data:{name:'bad',doc:{x:1}}})).status,400);
});
test('logout revokes session, challenges are rate limited, responses are private',async t=>{
  const{request,admin}=await fixture(t);
  const response=await admin('projects');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.equal((await admin('auth/logout',{method:'POST'})).status,200);assert.equal((await admin('projects')).status,401);
  for(let i=0;i<20;i++)await request('auth/challenge',{method:'POST'});
  assert.equal((await request('auth/challenge',{method:'POST'})).status,429);
});
