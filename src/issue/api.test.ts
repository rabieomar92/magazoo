import {afterEach,expect,it,vi} from 'vitest';import {issueApi} from './api';
afterEach(()=>vi.unstubAllGlobals());
it('loads metadata and bounded individual article responses, preserving snapshot order',async()=>{
 const items=Array.from({length:7},(_,i)=>({id:`doc-${i}`,name:`${i}.json`,version:2}));let active=0,max=0;
 const request=vi.fn(async(url:string)=>{
  if(url.endsWith('/metadata'))return{ok:true,json:async()=>({project:{id:'project'},items,plan:null})};
  active++;max=Math.max(max,active);await Promise.resolve();active--;
  const item=items.find(item=>url.endsWith('/'+item.id))!;return{ok:true,json:async()=>({...item,doc:{blocks:[item.id]}})};
 });vi.stubGlobal('fetch',request);
 const result=await issueApi<{items:{id:string;doc:{blocks:string[]}}[]}>('project','csrf');
 expect(result.items.map(item=>item.id)).toEqual(items.map(item=>item.id));expect(result.items[3].doc.blocks).toEqual(['doc-3']);expect(request).toHaveBeenCalledTimes(8);expect(max).toBeLessThanOrEqual(3);
});
it('refuses a changed article instead of compiling inconsistent versions',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.endsWith('/metadata')?{items:[{id:'doc',version:2}]}:{id:'doc',version:3,doc:{}}})));
 await expect(issueApi('project','csrf')).rejects.toThrow('changed while opening');
});
