/** Derived tile previews only. Never change an article, its images, or SQLite
 * schema. Network URLs remain browser redirects, not server-side fetches. */
export async function resizeHeroPreview(preview) {
  if (!preview || preview.location || preview.type === 'image/svg+xml') return preview;
  try {
    // Lazy import keeps a missing platform codec from taking the app offline.
    const {default:sharp} = await import('sharp');
    const bytes = await sharp(preview.bytes, {limitInputPixels:32_000_000, animated:false})
      .rotate().resize({width:600,height:600,fit:'inside',withoutEnlargement:true})
      .webp({quality:72,effort:2}).timeout({seconds:3}).toBuffer();
    return {type:'image/webp',bytes};
  } catch { return null; }
}

/** Version lookup is tiny even for a 64 MB article. Only a cache miss reads
 * its JSON. Bounded workers prevent a page of cards monopolising the server;
 * duplicate requests share work and the LRU stores derivatives, not articles. */
export function createHeroThumbnails({readVersion,readSource,decode,transform=resizeHeroPreview,maxEntries=64,maxBytes=8*1024*1024,concurrency=2}) {
  const cache=new Map(),pending=new Map(),queue=[];
  let bytes=0,active=0;
  const limited=async run=>{
    if(active>=concurrency)await new Promise(resolve=>queue.push(resolve));else active++;
    try{return await run();}finally{const next=queue.shift();if(next)next();else active--;}
  };
  const remember=(key,value)=>{
    const size=value.preview?.bytes?.length??0;
    if(size>maxBytes)return;
    if(cache.has(key)){bytes-=cache.get(key).size;cache.delete(key);}
    cache.set(key,{value,size});bytes+=size;
    while(cache.size>maxEntries||bytes>maxBytes){const oldest=cache.keys().next().value;bytes-=cache.get(oldest).size;cache.delete(oldest);}
  };
  const tag=(id,version)=>`"${id}.${version}.tile-v1"`;
  return {
    async get(id,ifNoneMatch){
      const version=readVersion(id);
      if(version===undefined)return undefined;
      const etag=tag(id,version);
      if(ifNoneMatch?.split(',').some(value=>value.trim()===etag||value.trim()===`W/${etag}`))return {etag,notModified:true};
      const key=`${id}:${version}`;
      const hit=cache.get(key);
      if(hit){cache.delete(key);cache.set(key,hit);return hit.value;}
      if(!pending.has(key)){
        const job=limited(async()=>{
          // Read version and source together after entering the worker. If a
          // queued article was saved meanwhile, cache under its actual version.
          const source=readSource(id);
          if(!source)return undefined;
          const preview=await transform(decode(source.source));
          const value={etag:tag(id,source.version),preview};
          remember(`${id}:${source.version}`,value);
          return value;
        });
        pending.set(key,job);
        void job.finally(()=>pending.delete(key)).catch(()=>{});
      }
      return pending.get(key);
    },
  };
}
