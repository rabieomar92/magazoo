import { useEffect, useRef, useState } from 'react';
import { emptyDoc, migrate, type Doc } from '../schema/document';
import '../styles/admin.css';
import AdminLibrary from './AdminLibrary';

interface Item { id:string; name:string; token:string; version:number; updated:number; }
interface Project { id:string; name:string; items:Item[]; }

const api=async(path:string,csrf:string,method='GET',data?:unknown)=>{
  const response=await fetch(`${import.meta.env.BASE_URL}api/${path}`,{method,signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await response.json().catch(()=>{throw new Error('The server returned an unexpected response. Please refresh and try again.');});
  if(!response.ok)throw new Error(result.error??'Request failed.');return result;
};
const sharedLink=(token:string)=>`${location.origin}${import.meta.env.BASE_URL}#edit=${token}`;

function DeleteDialog({target,close,remove}:{target:{name:string;path:string;project:boolean};close:()=>void;remove:()=>Promise<void>}) {
  const ref=useRef<HTMLDialogElement>(null);const[text,setText]=useState('');const[busy,setBusy]=useState(false);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="admin-dialog" onCancel={close} aria-labelledby="delete-title">
    <h2 id="delete-title">Delete {target.project?'project':'document'}?</h2>
    <p>{target.project?'This deletes every JSON document in this project.':'This deletes the JSON document.'} All affected sharing links will stop working. This cannot be undone here; download any copies you need first.</p>
    <label>Type <strong>{target.name}</strong> to confirm<input autoFocus value={text} onChange={e=>setText(e.target.value)} autoComplete="off" /></label>
    <div className="admin-actions"><button onClick={close} disabled={busy}>Cancel</button><button className="danger" disabled={text!==target.name||busy} onClick={()=>{setBusy(true);void remove().finally(()=>setBusy(false));}}>{busy?'Deleting…':'Permanently delete'}</button></div>
  </dialog>;
}

export default function AdminPage(){
  const[csrf,setCsrf]=useState('');const[checked,setChecked]=useState(false);const[projects,setProjects]=useState<Project[]>([]);
  const[error,setError]=useState('');const[notice,setNotice]=useState('');const[busy,setBusy]=useState(false);
  const[password,setPassword]=useState('');const[name,setName]=useState('');
  const importInput=useRef<HTMLInputElement>(null);
  const[itemName,setItemName]=useState('');const[projectId,setProjectId]=useState('');const[upload,setUpload]=useState<Doc|null>(null);
  const[deleting,setDeleting]=useState<{name:string;path:string;project:boolean}|null>(null);
  const refresh=async(key=csrf)=>{const list=await api('projects',key);setProjects(list);setProjectId(current=>list.some((p:Project)=>p.id===current)?current:list[0]?.id??'');};
  useEffect(()=>{let live=true;void api('auth/session','').then(async data=>{if(live){setCsrf(data.csrf);await refresh(data.csrf);}}).catch(()=>{}).finally(()=>{if(live)setChecked(true);});return()=>{live=false;};},[]);
  const run=async(fn:()=>Promise<void>)=>{setError('');setNotice('');setBusy(true);try{await fn();}catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}};
  return <main className="admin-page">
    {(!checked||busy)&&<div className="admin-loading" role="status"><span>{!checked?'Loading your workspace…':'Working… Please wait.'}</span><div className="loading-track"><span /></div></div>}
    <header className="admin-header"><div><a className="admin-brand" href={import.meta.env.BASE_URL}>Magazoo!</a><span>Project library</span></div><nav><a href={import.meta.env.BASE_URL}>Open editor</a>{csrf&&<button disabled={busy} onClick={()=>void run(async()=>{await api('auth/logout',csrf,'POST');setCsrf('');setProjects([]);})}>Log out</button>}</nav></header>
    <div className="admin-content">
      <div className="admin-intro"><p className="admin-eyebrow">Publication workspace</p><h1>{csrf?'Your projects, in one place.':'A private workspace for your publications.'}</h1><p>Organise editable Magazoo documents by project and share individual editing links.</p></div>
      {error&&<div className="admin-alert" role="alert">{error}</div>}{notice&&<div className="admin-notice" role="status">{notice}</div>}
      {!checked?<p role="status">Checking admin session…</p>:!csrf?<section className="admin-card admin-login">
        <h2>Sign in</h2><p>Enter the administrator password configured on the server. Your password is sent only over the secure connection and is never stored in this page.</p>
        <form onSubmit={e=>{e.preventDefault();void run(async()=>{const data=await api('auth/login','', 'POST',{password});setPassword('');setCsrf(data.csrf);await refresh(data.csrf);setNotice('Signed in.');});}}>
          <label>Password<input type="password" required minLength={8} maxLength={512} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" autoFocus /></label>
          <button className="primary" disabled={busy||password.length<8}>{busy?'Signing in…':'Sign in'}</button>
        </form>
      </section>:<>
        <div className="admin-create-grid"><form className="admin-card" onSubmit={e=>{e.preventDefault();void run(async()=>{await api('projects',csrf,'POST',{name});setName('');await refresh();setNotice('Project created.');});}}><h2>Create a project</h2><label>Project name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="School magazine · September 2026" /></label><button className="primary" disabled={busy||!name.trim()}>Create project</button></form>
          <form className="admin-card" onSubmit={e=>{e.preventDefault();void run(async()=>{const doc=upload??emptyDoc();if(!upload)doc.meta.title=itemName.replace(/\.json$/i,'');await api(`projects/${projectId}/documents`,csrf,'POST',{name:itemName,doc});setItemName('');setUpload(null);if(importInput.current)importInput.current.value='';await refresh();setNotice('Document created. Its private editing link is ready below.');});}}><h2>Add a JSON document</h2><label>Project<select required value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Choose a project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>File name<input required value={itemName} maxLength={115} onChange={e=>setItemName(e.target.value)} placeholder="research-highlights.json" /></label><label>Import an existing JSON (optional)<input ref={importInput} type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];setUpload(null);if(!f)return;void run(async()=>{if(f.size>64*1024*1024)throw new Error('File exceeds 64 MB.');setUpload(migrate(JSON.parse(await f.text())));if(!itemName)setItemName(f.name);});}} /></label><button className="primary" disabled={busy||!projectId||!itemName.trim()}>Create document & link</button></form></div>
        <div className="admin-library-title"><h2>Project library <span>{projects.length}</span></h2><button disabled={busy} onClick={()=>void run(()=>refresh())}>Refresh</button></div>
        <p className="admin-sharing-note">Anyone with a private link can read and edit that one document. Treat links like passwords. Edits save automatically; conflicting versions are never silently overwritten.</p>
        <AdminLibrary projects={projects} busy={busy} onDelete={setDeleting} link={sharedLink} onCopy={item=>void run(async()=>{await navigator.clipboard.writeText(sharedLink(item.token));setNotice(`Private editing link copied for ${item.name}.`);})} />
      </>}
      <footer className="admin-footnote">Keep regular server backups. Deleting a project also revokes every document link inside it.</footer>
    </div>
    {deleting&&<DeleteDialog target={deleting} close={()=>setDeleting(null)} remove={()=>run(async()=>{await api(deleting.path,csrf,'DELETE',{confirmation:deleting.name});setDeleting(null);await refresh();setNotice('Deleted. Affected editing links have been revoked.');})} />}
  </main>;
}
