import type { Doc } from '../schema/document';
import { cleanOrphanedAssets } from '../schema/document';
import { serializationMessage, type SerializationAssets } from './serializeProtocol';
let worker: Worker | undefined;
let postedAssets: SerializationAssets = {};
let sequence=0;
const jobs=new Map<number,{resolve:(text:string)=>void;reject:(error:Error)=>void}>();

function serializationWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL('./serializeWorker.ts',import.meta.url),{type:'module'});
  worker = created;
  postedAssets = {};
  created.onmessage=({data})=>{
    if (worker !== created) return;
    const job=jobs.get(data.id);
    jobs.delete(data.id);
    if(data.error)job?.reject(new Error(data.error));
    else job?.resolve(data.text);
  };
  const failed=()=>{
    if (worker !== created) return;
    for(const job of jobs.values())job.reject(new Error('Unable to prepare the document for saving.'));
    jobs.clear();
    created.terminate();
    worker=undefined;
    postedAssets={};
  };
  created.onerror=failed;
  created.onmessageerror=failed;
  return created;
}

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
  return new Promise((resolve,reject)=>{
    const id=++sequence;
    jobs.set(id,{resolve,reject});
    try {
      const target=serializationWorker();
      const {message,assets}=serializationMessage(id,doc,postedAssets);
      target.postMessage(message);
      // Worker messages are FIFO. Advance only after a successful post so a
      // failed structured clone cannot make the next delta omit a new photo.
      postedAssets=assets;
    } catch(error) {
      jobs.delete(id);
      reject(error);
    }
  });
}
