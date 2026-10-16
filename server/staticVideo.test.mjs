import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {createApp} from './app.mjs';
import {openStorage} from './storage.mjs';

test('public background video streams correct ranges and MIME without caching login HTML or private APIs',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'magazoo-video-'));
  await mkdir(join(dir,'media'));const bytes=Buffer.from('0123456789abcdef');
  await writeFile(join(dir,'media','login-network.mp4'),bytes);
  await writeFile(join(dir,'media','login-network-poster.jpg'),bytes);
  await writeFile(join(dir,'index.html'),'<h1>Login</h1>');
  const storage=openStorage(':memory:');
  const server=createApp({storage,origin:'http://127.0.0.1',staticDir:dir});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(r=>server.close(r));storage.close();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('magazoo-video-'));await rm(dir,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const get=(path='/media/login-network.mp4',options)=>fetch(origin+path,options);
  const whole=await get();assert.equal(whole.status,200);assert.equal(whole.headers.get('content-type'),'video/mp4');
  assert.equal(whole.headers.get('content-length'),'16');assert.equal(whole.headers.get('accept-ranges'),'bytes');
  assert.equal(whole.headers.get('cache-control'),'public, max-age=86400');assert.deepEqual(Buffer.from(await whole.arrayBuffer()),bytes);
  for(const [range,wanted,text] of [['bytes=0-1','bytes 0-1/16','01'],['bytes=3-7','bytes 3-7/16','34567'],['bytes=12-','bytes 12-15/16','cdef'],['bytes=-4','bytes 12-15/16','cdef'],['bytes=14-100','bytes 14-15/16','ef']]){
    const response=await get(undefined,{headers:{Range:range}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),wanted);assert.equal(await response.text(),text);
  }
  for(const range of ['bytes=100-','bytes=6-2','bytes=-0','bytes=-','bytes=0-2,4-5','bytes=999999999999999999999-']){
    const response=await get(undefined,{headers:{Range:range}});assert.equal(response.status,416);assert.equal(response.headers.get('content-range'),'bytes */16');assert.equal((await response.arrayBuffer()).byteLength,0);
  }
  const head=await get(undefined,{method:'HEAD',headers:{Range:'bytes=0-1'}});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'16');assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await get('/')).headers.get('cache-control'),'no-store');
  const privateApi=await get('/api/projects');assert.equal(privateApi.status,401);assert.equal(privateApi.headers.get('cache-control'),'no-store');
  const poster=await get('/media/login-network-poster.jpg');assert.equal(poster.headers.get('content-type'),'image/jpeg');assert.equal(poster.headers.get('cache-control'),'public, max-age=86400');
});
