import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createHeroThumbnails,resizeHeroPreview} from './heroThumbnails.mjs';

test('large originals become bounded, small WebP tiles without changing source bytes',async()=>{
  const bytes=await sharp({create:{width:2400,height:1600,channels:3,background:'#8855aa'}}).png().toBuffer();
  const original=Buffer.from(bytes),preview=await resizeHeroPreview({type:'image/png',bytes});
  const metadata=await sharp(preview.bytes).metadata();
  assert.equal(preview.type,'image/webp');assert.equal(metadata.width,600);assert.equal(metadata.height,400);
  assert.ok(preview.bytes.length<bytes.length);assert.deepEqual(bytes,original);
  assert.equal(await resizeHeroPreview({type:'image/png',bytes:Buffer.from('not an image')}),null);
  assert.equal(await resizeHeroPreview(null),null);
});
test('small/transparent images are not enlarged and remote/SVG previews never trigger external decoding',async()=>{
  const bytes=await sharp({create:{width:60,height:30,channels:4,background:{r:20,g:40,b:80,alpha:.5}}}).png().toBuffer();
  const thumbnail=await resizeHeroPreview({type:'image/png',bytes}),metadata=await sharp(thumbnail.bytes).metadata();
  assert.equal(metadata.width,60);assert.equal(metadata.height,30);assert.equal(metadata.hasAlpha,true);
  for(const preview of [{location:'https://example.org/image.png'},{type:'image/svg+xml',bytes:Buffer.from('<svg/>')}])assert.equal(await resizeHeroPreview(preview),preview);
});
test('cached tiles use current versions, share concurrent work, and revalidate without reading the article',async()=>{
  let version=1,reads=0,transforms=0;
  const cache=createHeroThumbnails({readVersion:()=>version,readSource:()=>{reads++;return{version,source:'image'};},decode:()=>({type:'image/png',bytes:Buffer.from('source')}),transform:async()=>{transforms++;await new Promise(resolve=>setTimeout(resolve,5));return{type:'image/webp',bytes:Buffer.from('tile')};}});
  const [first,duplicate]=await Promise.all([cache.get('id'),cache.get('id')]);
  assert.equal(first,duplicate);assert.equal(reads,1);assert.equal(transforms,1);
  assert.equal(await cache.get('id'),first);assert.equal(reads,1);
  assert.deepEqual(await cache.get('id',first.etag),{etag:first.etag,notModified:true});assert.equal(reads,1);
  version=2;const updated=await cache.get('id',first.etag);assert.notEqual(updated.etag,first.etag);assert.equal(reads,2);
  assert.deepEqual(await cache.get('id',`W/${updated.etag}`),{etag:updated.etag,notModified:true});
  version=undefined;assert.equal(await cache.get('id'),undefined);
});
test('bounded cache evicts old versions and workers bound simultaneous decoding',async()=>{
  let reads=0,active=0,maximum=0;
  const cache=createHeroThumbnails({maxEntries:2,maxBytes:8,concurrency:2,readVersion:()=>1,readSource:()=>{reads++;return{version:1,source:'image'};},decode:()=>({}),transform:async()=>{maximum=Math.max(maximum,++active);await new Promise(resolve=>setTimeout(resolve,3));active--;return{type:'image/webp',bytes:Buffer.from('tile')};}});
  await Promise.all(['a','b','c','d'].map(id=>cache.get(id)));assert.equal(maximum,2);assert.equal(reads,4);
  await cache.get('a');assert.equal(reads,5);
});
test('queued previews use the actual saved version and missing/deleted images do not leak cached content',async()=>{
  let version=1,exists=true;
  const cache=createHeroThumbnails({readVersion:()=>exists?version:undefined,readSource:()=>exists?{version:++version,source:null}:undefined,decode:()=>null});
  const result=await cache.get('id');assert.match(result.etag,/\.2\.tile-v1/);assert.equal(result.preview,null);
  exists=false;assert.equal(await cache.get('id',result.etag),undefined);
});
