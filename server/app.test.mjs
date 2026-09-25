import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openStorage } from './storage.mjs';
import { createApp } from './app.mjs';
import { hashPassword } from './passwordAuth.mjs';
const doc={schemaVersion:1,meta:{title:'Test document'},blocks:[],design:{},assets:{}};
test('project rename is admin-only, validates names and preserves documents and issue arrangements',async t=>{
  const {storage,request,admin,cookie}=await fixture(t);
  const project=storage.createProject('Original');
  const item=storage.createDocument(project.id,'story.json',JSON.stringify(doc));
  storage.createProject('Taken');
  const plan={order:['__contents__',item.id],startNumber:1,countCovers:false,contentsTitle:'Contents',contentsSubtitle:'',direction:'ltr',contentsExcluded:[]};
  storage.saveIssue(project.id,0,plan);
  const before=storage.readIssue(project.id);
  const saved=storage.read(item.token);
  const path=`projects/${project.id}`;
  const data={name:'Renamed',previousName:'Original'};
  assert.equal((await request(path,{method:'PATCH',data})).status,401);
  assert.equal((await request(path,{method:'PATCH',data,headers:{Authorization:`Bearer ${item.token}`}})).status,401);
  assert.equal((await request(path,{method:'PATCH',data,headers:{Cookie:cookie}})).status,403);
  assert.equal((await admin(path,{method:'PATCH',data,headers:{Origin:'https://evil.example'}})).status,403);
  for(const name of ['', '../bad', 'x'.repeat(121), '\u0000bad'])assert.equal((await admin(path,{method:'PATCH',data:{...data,name}})).status,400);
  assert.equal((await admin(path,{method:'PATCH',data:null})).status,400);
  assert.equal((await admin(path,{method:'PATCH',data:{...data,name:'Taken'}})).status,409);
  assert.equal((await admin('projects/missing',{method:'PATCH',data})).status,404);
  const result=await admin(path,{method:'PATCH',data:{...data,name:'  Renamed  '}});
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{id:project.id,name:'Renamed'});
  assert.equal((await admin(path,{method:'PATCH',data:{...data,name:'Stale overwrite'}})).status,409);
  assert.deepEqual(storage.read(item.token),saved);
  const after=storage.readIssue(project.id);
  assert.deepEqual({...after,project:{...after.project}},{...before,project:{...before.project,name:'Renamed'}});
  assert.equal((await request('documents/shared',{headers:{Authorization:`Bearer ${item.token}`}})).status,200);
});
async function fixture(t){
  const storage=openStorage(':memory:');
  const errors=[];
  const server=createApp({storage,origin:'http://127.0.0.1',passwordHash:hashPassword('correct horse battery staple'),reportError:event=>errors.push(event)});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(()=>{storage.close();resolve();})));
  const endpoint=`http://127.0.0.1:${server.address().port}/api/`;
  const request=(path,{method='GET',data,headers={}}={})=>fetch(endpoint+path,{method,headers:{Origin:'http://127.0.0.1','Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)});
  const logged=await request('auth/login',{method:'POST',data:{password:'correct horse battery staple'}});
  const cookie=logged.headers.getSetCookie()[0].split(';')[0];const {csrf}=await logged.json();
  const admin=(path,options={})=>request(path,{...options,headers:{Cookie:cookie,'X-CSRF-Token':csrf,...options.headers}});
  return{storage,request,admin,cookie,csrf,errors};
}

test('unexpected issue failures have a correlated safe diagnostic, with no private data in the response or log', async t => {
  const { storage, admin, errors } = await fixture(t);
  t.mock.method(storage, 'readIssue', () => {
    throw Object.assign(new TypeError('secret article copy / private-link-token / password-value'),
      { issueStage: 'documents', projectId: 'test-project' });
  });
  const response = await admin('projects/test-project/issue?private=secret-query');
  assert.equal(response.status, 500);
  const result = await response.json();
  assert.ok(result.reference);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].reference, result.reference);
  assert.equal(errors[0].operation, 'issue-load');
  assert.equal(errors[0].stage, 'documents');
  assert.match(result.error, /Reference:/);
  const exposed = JSON.stringify([result, errors]);
  for (const secret of ['secret article copy', 'private-link-token', 'password-value', 'secret-query', 'magazoo_admin']) {
    assert.ok(!exposed.includes(secret));
  }
});

test('a partially deployed server produces an actionable response instead of a generic crash', async t => {
  const { storage, admin, errors } = await fixture(t);
  storage.readIssue = undefined;
  const response = await admin('projects/test-project/issue');
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Deploy the complete server folder/);
  assert.equal(errors[0].code, 'ISSUE_SERVICE_OUTDATED');
});

test('an unreadable saved article is identified without returning its content or changing any source', async t => {
  const { storage, admin, errors } = await fixture(t);
  const project = storage.createProject('Issue with a damaged file');
  const good = storage.createDocument(project.id, 'good.json', JSON.stringify(doc));
  const bad = storage.createDocument(project.id, 'broken.json', '{private damaged content');
  const before = storage.read(good.token);
  const damaged = storage.read(bad.token);
  const response = await admin(`projects/${project.id}/issue`);
  assert.equal(response.status, 422);
  const result = await response.json();
  assert.match(result.error, /broken\.json/);
  assert.equal(errors[0].code, 'ISSUE_DOCUMENT_UNREADABLE');
  assert.equal(errors[0].documentId, bad.id);
  assert.ok(!JSON.stringify([result, errors]).includes('private damaged content'));
  assert.deepEqual(storage.read(good.token), before);
  assert.deepEqual(storage.read(bad.token), damaged);
});

test('response serialization errors return valid error JSON, never a truncated successful response', async t => {
  const { storage, admin, errors } = await fixture(t);
  const circular = {}; circular.self = circular;
  t.mock.method(storage, 'readIssue', () => circular);
  const response = await admin('projects/test-project/issue');
  assert.equal(response.status, 500);
  const result = await response.json();
  assert.equal(result.reference, errors[0].reference);
});

test('database errors distinguish a busy database from an outdated schema without leaking raw errors', async t => {
  const { storage, admin } = await fixture(t);
  const read = t.mock.method(storage, 'readIssue', () => { throw Object.assign(new Error('database is locked'), { errcode: 5 }); });
  const busy = await admin('projects/test-project/issue');
  assert.equal(busy.status, 503);
  assert.match((await busy.json()).error, /database is busy/);
  read.mock.mockImplementation(() => { throw new Error('no such column: private_column_name'); });
  const schema = await admin('projects/test-project/issue');
  assert.equal(schema.status, 500);
  const message = (await schema.json()).error;
  assert.match(message, /schema does not match/);
  assert.ok(!message.includes('private_column_name'));
});
test('password login creates a session; admin session and CSRF are required',async t=>{
  const{request,admin,cookie}=await fixture(t);
  assert.equal((await request('projects')).status,401);
  assert.equal((await request('projects',{method:'POST',data:{name:'X'},headers:{Cookie:cookie}})).status,403);
  assert.equal((await admin('projects',{method:'POST',data:{name:'X'},headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await request('auth/login',{method:'POST',data:{password:'wrong password'}})).status,401);
  assert.equal((await request('auth/login',{method:'POST',data:{password:''}})).status,400);
});
test('missing password configuration never opens the admin API',async t=>{
  const storage=openStorage(':memory:');
  const server=createApp({storage,origin:'http://127.0.0.1'});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(()=>{storage.close();resolve();})));
  const endpoint=`http://127.0.0.1:${server.address().port}/api/`;
  const response=await fetch(endpoint+'auth/login',{method:'POST',headers:{Origin:'http://127.0.0.1','Content-Type':'application/json'},body:JSON.stringify({password:'correct horse battery staple'})});
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/MAGAZOO_ADMIN_PASSWORD_HASH/);
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
test('logout revokes session, password attempts are rate limited, responses are private',async t=>{
  const{request,admin}=await fixture(t);
  const response=await admin('projects');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.equal((await admin('auth/logout',{method:'POST'})).status,200);assert.equal((await admin('projects')).status,401);
  for(let i=0;i<20;i++)await request('auth/login',{method:'POST',data:{password:'wrong password'}});
  assert.equal((await request('auth/login',{method:'POST',data:{password:'wrong password'}})).status,429);
});

test('issue API requires admin and CSRF, does not disclose shared tokens, and validates arrangements', async t => {
  const { storage, request, admin, cookie } = await fixture(t);
  const project = storage.createProject('Issue');
  const item = storage.createDocument(project.id, 'article.json', JSON.stringify(doc));
  const route = `projects/${project.id}/issue`;
  const plan = { order: ['__contents__', item.id], startNumber: 1, countCovers: false,
    contentsTitle: 'Contents', contentsSubtitle: '', direction: 'ltr', contentsExcluded: [] };
  assert.equal((await request(route)).status, 401);
  assert.equal((await request(route, { headers: { Authorization: `Bearer ${item.token}` } })).status, 401);
  assert.equal((await request(route, { method: 'PUT', data: { version: 0, plan }, headers: { Cookie: cookie } })).status, 403);
  assert.equal((await request(`${route}/finalize`, { method: 'POST', data: {}, headers: { Cookie: cookie } })).status, 403);
  const initial = await (await admin(route)).json();
  assert.equal(initial.version, 0);
  assert.equal(initial.plan, null);
  assert.equal(initial.items[0].id, item.id);
  assert.equal(initial.items[0].token, undefined);
  assert.deepEqual(initial.items[0].doc, doc);
  for (const order of [[item.id, item.id, '__contents__'], ['__contents__'], [item.id], [item.id, '__contents__', 'unknown']]) {
    assert.equal((await admin(route, { method: 'PUT', data: { version: 0, plan: { ...plan, order } } })).status, 400);
  }
  assert.equal((await admin(route, { method: 'PUT', data: { version: 0, plan: { ...plan, contentsTitle: 'a'.repeat(501) } } })).status, 400);
  assert.equal((await admin(route, { method: 'PUT', data: { version: 0, plan: { ...plan, contentsExcluded: ['unknown'] } } })).status, 400);
  assert.equal((await admin(route, { method: 'PUT', data: { version: 0, plan } })).status, 200);
  assert.equal(storage.read(item.token).version, 1, 'arrangement save does not touch source files');
  assert.equal((await admin(route, { method: 'PUT', data: { version: 0, plan } })).status, 409);
  assert.equal((await admin('projects/missing/issue')).status, 404);
});

test('issue finalization rejects a concurrent editor save without partial writes', async t => {
  const { storage, request, admin } = await fixture(t);
  const project = storage.createProject('Concurrent issue');
  const first = storage.createDocument(project.id, 'first.json', JSON.stringify(doc));
  const second = storage.createDocument(project.id, 'second.json', JSON.stringify(doc));
  const route = `projects/${project.id}/issue`;
  const plan = { order: [first.id, '__contents__', second.id], startNumber: 1, countCovers: false,
    contentsTitle: 'Contents', contentsSubtitle: '', direction: 'rtl', contentsExcluded: [] };
  const documents = [{ id: first.id, version: 1, pageCount: 3, startNumber: 1 }, { id: second.id, version: 1, pageCount: 2, startNumber: 6 }];
  const originalFirst = storage.read(first.token);
  const edited = { ...doc, meta: { title: 'Live author edits محفوظ' }, highlights: { title: 'Keep', items: ['Preserved'] } };
  await request('documents/shared', { method: 'PUT', data: edited,
    headers: { Authorization: `Bearer ${second.token}`, 'If-Match': '1' } });
  assert.equal((await admin(`${route}/finalize`, { method: 'POST', data: { version: 0, plan, documents } })).status, 409);
  assert.deepEqual(storage.read(first.token), originalFirst);
  assert.deepEqual(JSON.parse(storage.read(second.token).body), edited);
  assert.equal((await (await admin(route)).json()).version, 0);
  documents[1].version = 2;
  const finalized = await admin(`${route}/finalize`, { method: 'POST', data: { version: 0, plan, documents } });
  assert.equal(finalized.status, 200);
  assert.deepEqual(await finalized.json(), { version: 1, items: [{ id: first.id, version: 2 }, { id: second.id, version: 3 }] });
  const snapshot = await (await admin(route)).json();
  assert.equal(snapshot.finalized.contentsStartNumber, 4);
  assert.equal(snapshot.sourcesChanged, false);
  // A stale shared editor cannot silently overwrite the newly assigned folio.
  assert.equal((await request('documents/shared', { method: 'PUT', data: edited,
    headers: { Authorization: `Bearer ${second.token}`, 'If-Match': '2' } })).status, 409);
  storage.update(second.token, 3, JSON.stringify({ ...edited, footer: { startNumber: 6 } }));
  assert.equal((await (await admin(route)).json()).sourcesChanged, true);
});
