import { migrate } from '../schema/document';
import { loadSession } from './db';
import { bindTarget, useProjectFile } from './projectFiles';
import { useDoc } from './useDoc';
export const sharedToken=()=>location.hash.match(/^#edit=([\w-]{43})$/)?.[1];
export async function loadSharedProject(token:string, cancelled=()=>false) {
  const cached=await loadSession(token).catch(()=>undefined);
  const response=await fetch(`${import.meta.env.BASE_URL}api/documents/shared`,{headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)throw new Error('This private document could not be opened. Check the link and connection. Your local draft has not been changed.');
  const latest=await response.json();
  if(cancelled())return;
  const recovered=!!cached?.pending && cached.target?.kind==='online';
  const doc=migrate(recovered ? cached!.doc : latest.doc);
  const version=recovered && cached!.target?.kind==='online' ? cached!.target.version:latest.version;
  bindTarget({kind:'online',token,name:latest.name,version},recovered?null:doc);
  useDoc.getState().load(doc);
  if(recovered && version!==latest.version)useProjectFile.setState({status:'conflict',message:'Recovered unsynced edits, but a newer online version exists. Save As a local copy before reopening the shared link. Nothing has been overwritten.'});
}
