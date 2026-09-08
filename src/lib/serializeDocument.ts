import type { Doc } from '../schema/document';
import { cleanOrphanedAssets } from '../schema/document';
let worker: Worker | undefined;
let sequence=0;
const jobs=new Map<number,{resolve:(text:string)=>void;reject:(error:Error)=>void}>();
/** Large embedded photos are serialized after typing settles, off the UI thread. */
export function serializeDocument(doc:Doc):Promise<string> {
  if(typeof Worker==='undefined') {
    // `cleanOrphanedAssets` removes entries from the object it receives. Keep
    // that cleanup out of the live Zustand document when the browser has no
    // Worker support; otherwise a save could silently mutate the editor state
    // without creating an undo/autosave revision.
    const snapshot = { ...doc, assets: { ...doc.assets } };
    return Promise.resolve(JSON.stringify(cleanOrphanedAssets(snapshot)));
  }
  worker ??= new Worker(new URL('./serializeWorker.ts',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const job=jobs.get(data.id);jobs.delete(data.id);if(data.error)job?.reject(new Error(data.error));else job?.resolve(data.text);};
  worker.onerror=()=>{for(const job of jobs.values())job.reject(new Error('Unable to prepare the document for saving.'));jobs.clear();worker?.terminate();worker=undefined;};
  return new Promise((resolve,reject)=>{const id=++sequence;jobs.set(id,{resolve,reject});try{worker!.postMessage({id,doc});}catch(error){jobs.delete(id);reject(error);}});
}
