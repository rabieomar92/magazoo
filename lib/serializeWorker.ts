import { cleanOrphanedAssets } from '../schema/document';
self.onmessage=({data})=>{try { self.postMessage({id:data.id,text:JSON.stringify(cleanOrphanedAssets(data.doc))}); }
catch(error){self.postMessage({id:data.id,error:error instanceof Error ? error.message:'Could not prepare document'});}};
