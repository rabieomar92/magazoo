import { cleanOrphanedAssets } from '../schema/document';
import { hydrateSerializationMessage, type SerializationAssets, type SerializationMessage } from './serializeProtocol';

let assets: SerializationAssets = {};
self.onmessage=({data}:{data:SerializationMessage})=>{try {
  const hydrated=hydrateSerializationMessage(data,assets);
  // Retain the last posted asset set even if this document cannot stringify.
  // The sender has already advanced to it when postMessage succeeded.
  assets=hydrated.assets;
  self.postMessage({id:data.id,text:JSON.stringify(cleanOrphanedAssets(hydrated.doc))});
}
catch(error){self.postMessage({id:data.id,error:error instanceof Error ? error.message:'Could not prepare document'});}};
