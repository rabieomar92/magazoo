import { migrate } from '../schema/document';
import { loadSession } from './db';
import { bindTarget, useProjectFile } from './projectFiles';
import { useDoc } from './useDoc';
import { acquireEditLease, EditLeaseError, releaseOwnedLease, useEditLease } from './editLease';
export const sharedToken=()=>location.hash.match(/^#edit=([\w-]{43})$/)?.[1];
export async function loadSharedProject(token:string, cancelled=()=>false, discardRecovery=false) {
  const cached=await loadSession(token).catch(()=>undefined);
  if(cancelled())return;
  const previous=useProjectFile.getState();
  const memory=previous.target?.kind==='online' && previous.target.token===token && previous.savedDoc!==useDoc.getState().doc ? {doc:useDoc.getState().doc,target:previous.target}:undefined;
  let latest;
  try { latest=await acquireEditLease(token); }
  catch(error) {
    if(error instanceof EditLeaseError && error.status===423 && !memory) {
      const response=await fetch(`${import.meta.env.BASE_URL}api/documents/shared`,{headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok)throw new Error('Could not load the read-only preview. Please try again.');
      if(!cancelled()){useDoc.getState().load(migrate((await response.json()).doc));bindTarget(null,null);}
      return;
    }
    throw error;
  }
  if(cancelled()){await releaseOwnedLease(token,latest.leaseId);return;}
  try {
  const recovery=discardRecovery ? undefined : memory ?? (cached?.pending && cached.target?.kind==='online' ? cached:undefined);
  const recovered=!!recovery;
  const doc=migrate(recovery ? recovery.doc : latest.doc);
  const version=recovery?.target?.kind==='online' ? recovery.target.version:latest.version;
  bindTarget({kind:'online',token,name:latest.name,version},recovered?null:doc);
  useDoc.getState().load(doc);
  if(recovered && version!==latest.version){
    await releaseOwnedLease(token,latest.leaseId);
    const message='Recovered unsaved edits, but the online document has changed. Download your draft before loading the latest version. Nothing has been overwritten.';
    useProjectFile.setState({status:'conflict',message});useEditLease.setState({status:'recovery',message});
  }
  } catch(error) {
    await releaseOwnedLease(token,latest.leaseId);
    useEditLease.setState({status:'error',message:'This document could not be loaded safely. No changes have been saved. Please retry.'});
    throw error;
  }
}
