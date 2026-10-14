import { useEffect, useState } from 'react';
import { useDoc } from '../store/useDoc';
import { useEditLease, releaseEditLease } from '../store/editLease';
import { downloadCopy, saveToTarget, useProjectFile } from '../store/projectFiles';
import { loadSharedProject } from '../store/sharedProject';
import { PaperPreviewLayout } from '../paper/PaperPreview';
import './shared-editing.css';

export function SharedEditingAccess({ token }: {token:string}) {
  const lease=useEditLease();const doc=useDoc(s=>s.doc);const project=useProjectFile();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const dirty=project.target?.kind==='online'&&project.savedDoc!==doc;
  useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const resume=async(discard=false)=>{
    if(discard&&!confirm('Load the latest online version? Download your unsaved draft first if you need it.'))return;
    setBusy(true);setError('');
    try{await loadSharedProject(token,()=>false,discard);}catch(e){setError(e instanceof Error?e.message:'Could not reconnect.');}finally{setBusy(false);}
  };
  const finish=async()=>{
    setBusy(true);setError('');
    try{await saveToTarget(useDoc.getState().doc,true);if(useProjectFile.getState().savedDoc!==useDoc.getState().doc)throw new Error('There are still unsaved changes. Please wait for saving to finish.');await releaseEditLease(token);}catch(e){setError(e instanceof Error?e.message:'Could not save. Editing access has not been released.');}finally{setBusy(false);}
  };
  if(lease.status==='active')return <div className="editing-access editing-access--active" role="status">
    <span><strong>Editing reserved for you</strong> · Other visitors are read-only.</span>
    <button type="button" onClick={()=>void finish()} disabled={busy}>{busy?'Saving…':'Save & finish editing'}</button>
    {error&&<span role="alert">{error}</span>}
  </div>;
  return <main className="shared-readonly">
    <section className="editing-access editing-access--blocked">
      <div><span className="editing-access-label">{lease.status==='loading'?'CONNECTING':'READ-ONLY'}</span><h1>{lease.status==='blocked'?'Someone else is editing':lease.status==='released'?'Editing finished':lease.status==='recovery'?'Your draft needs review':'Editing is paused'}</h1>
      <p>{lease.message}</p><p className="editing-access-note">Closing the editor normally releases access. If a browser crashes or disconnects, access recovers within about 3 minutes. Switching tabs does not release it.</p></div>
      <div className="editing-access-actions">
        <button className="tool-btn tool-btn--primary" disabled={busy||lease.status==='loading'} onClick={()=>void resume()}>{busy?'Checking…':lease.status==='blocked'?'Check & start editing':'Reconnect to edit'}</button>
        {dirty&&<button className="tool-btn" onClick={()=>void downloadCopy().catch(()=>setError('Could not download the draft. Please try again.'))}>Download my unsaved draft</button>}
        {lease.status==='recovery'&&<button className="tool-btn" disabled={busy} onClick={()=>void resume(true)}>Load latest after saving my copy</button>}
      </div>
      {error&&<p role="alert">{error}</p>}
    </section>
    {['blocked','lost','released','recovery'].includes(lease.status)&&<PaperPreviewLayout doc={doc} pending={false} toolbarHost={null} readOnly/>}
  </main>;
}
