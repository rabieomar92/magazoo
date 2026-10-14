import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStorage } from './storage.mjs';
import { createApp } from './app.mjs';
const doc={schemaVersion:1,meta:{title:'Original'},blocks:[],design:{},assets:{}};
const a='a'.repeat(36), b='b'.repeat(36);
function fixture(t){let clock=1000;const storage=openStorage(':memory:',{now:()=>clock,leaseMs:100});t.after(()=>storage.close());const project=storage.createProject('Locked project');const item=storage.createDocument(project.id,'one.json',JSON.stringify(doc));return{storage,project,item,tick:(n)=>clock+=n};}
test('leases exclusively gate every write; exact owner release is idempotent',t=>{
 const {storage,item}=fixture(t);
 assert.throws(()=>storage.update(item.token,1,JSON.stringify(doc)),{status:423});
 assert.equal(storage.editLease(item.token,'acquire',a).version,1);
 assert.throws(()=>storage.editLease(item.token,'acquire',b),{status:423});
 assert.throws(()=>storage.update(item.token,1,'{}',b),{status:423});
 storage.editLease(item.token,'release',b);assert.equal(storage.lockStatus(item.token).locked,true);
 assert.equal(storage.update(item.token,1,JSON.stringify({...doc,meta:{title:'Saved'}}),a),true);
 assert.equal(storage.update(item.token,1,'{}',a),false);
 storage.editLease(item.token,'release',a);storage.editLease(item.token,'release',a);
 assert.equal(storage.editLease(item.token,'acquire',b).doc.meta.title,'Saved');
 storage.editLease(item.token,'release',a);assert.equal(storage.lockStatus(item.token).locked,true);
});
test('expiry, renew and stale saves cannot revive a former editing session',t=>{
 const {storage,item,tick}=fixture(t);storage.editLease(item.token,'acquire',a);tick(80);storage.editLease(item.token,'renew',a);tick(80);
 assert.throws(()=>storage.editLease(item.token,'acquire',b),{status:423});tick(21);
 assert.throws(()=>storage.editLease(item.token,'renew',a),{status:423});
 storage.editLease(item.token,'acquire',b);
 assert.throws(()=>storage.update(item.token,1,'{}',a),{status:423});
 assert.equal(storage.read(item.token).version,1);
});
test('locks survive server/storage reopen and coordinate separate SQLite connections',t=>{
 const directory=mkdtempSync(join(tmpdir(),'magazoo-lock-test-'));const file=join(directory,'test.sqlite');let clock=0;
 let first=openStorage(file,{now:()=>clock,leaseMs:100});const project=first.createProject('Test'),item=first.createDocument(project.id,'x.json',JSON.stringify(doc));first.editLease(item.token,'acquire',a);first.close();
 first=openStorage(file,{now:()=>clock,leaseMs:100});const second=openStorage(file,{now:()=>clock,leaseMs:100});
 t.after(()=>{first.close();second.close();rmSync(directory,{recursive:true});});
 assert.throws(()=>second.editLease(item.token,'acquire',b),{status:423});clock=101;
 second.editLease(item.token,'acquire',b);assert.throws(()=>first.update(item.token,1,'{}',a),{status:423});
});
test('finalisation and deletion do not modify documents while someone edits',t=>{
 const {storage,item,project}=fixture(t);const plan={order:[item.id,'__contents__'],startNumber:1,countCovers:false,contentsTitle:'Contents',contentsSubtitle:'',direction:'ltr',contentsExcluded:[]};
 storage.editLease(item.token,'acquire',a);
 assert.throws(()=>storage.finalizeIssue(project.id,0,plan,[{id:item.id,version:1,pageCount:1,startNumber:1}]),{status:423});
 assert.throws(()=>storage.removeDocument(item.id,'one.json'),{status:423});assert.throws(()=>storage.removeProject(project.id,'Locked project'),{status:423});
 assert.equal(storage.read(item.token).version,1);assert.equal(storage.readIssue(project.id).version,0);
});
test('simultaneous HTTP arrivals grant one tab, reject legacy saves, and enforce origin',async t=>{
 const storage=openStorage(':memory:');const project=storage.createProject('HTTP'),item=storage.createDocument(project.id,'x.json',JSON.stringify(doc));
 const server=createApp({storage,origin:'http://127.0.0.1'});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>server.close(()=>{storage.close();resolve();})));
 const base=`http://127.0.0.1:${server.address().port}/api/documents/shared`;
 const headers={Origin:'http://127.0.0.1',Authorization:`Bearer ${item.token}`,'Content-Type':'application/json'};
 const acquire=id=>fetch(base+'/lock',{method:'POST',headers,body:JSON.stringify({action:'acquire',leaseId:id})});
 const responses=await Promise.all([acquire(a),acquire(b)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,423]);
 const owner=responses[0].status===200?a:b;
 assert.equal((await fetch(base,{method:'PUT',headers:{...headers,'If-Match':'1'},body:JSON.stringify(doc)})).status,423);
 assert.equal((await fetch(base,{method:'PUT',headers:{...headers,'If-Match':'1','X-Edit-Lease':owner},body:JSON.stringify(doc)})).status,200);
 assert.equal((await fetch(base+'/lock',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify({action:'release',leaseId:owner})})).status,403);
 const status=await(await fetch(base+'/lock',{headers})).json();assert.deepEqual(status,{locked:true});
});
