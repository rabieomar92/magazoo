import { useEffect, useRef, useState } from 'react';
import { emptyDoc, migrate, type Doc } from '../schema/document';
import '../styles/admin.css';

interface Item { id:string; name:string; token:string; version:number; updated:number; }
interface Project { id:string; name:string; items:Item[]; }
const api=async(path:string,csrf:string,method='GET',data?:unknown)=>{
  const response=await fetch(`${import.meta.env.BASE_URL}api/${path}`,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await response.json().catch(()=>({error:'Online projects are not available on this host. Start the Magazoo server or use your hosted admin address.'}));
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
  const[challenge,setChallenge]=useState<{id:string;message:string;expires:number}|null>(null);
  const[signature,setSignature]=useState('');const[name,setName]=useState('');
  const importInput=useRef<HTMLInputElement>(null);
  const[itemName,setItemName]=useState('');const[projectId,setProjectId]=useState('');const[upload,setUpload]=useState<Doc|null>(null);
  const[deleting,setDeleting]=useState<{name:string;path:string;project:boolean}|null>(null);
  const refresh=async(key=csrf)=>{const list=await api('projects',key);setProjects(list);setProjectId(current=>list.some((p:Project)=>p.id===current)?current:list[0]?.id??'');};
  useEffect(()=>{let live=true;void api('auth/session','').then(async data=>{if(live){setCsrf(data.csrf);await refresh(data.csrf);}}).catch(()=>{}).finally(()=>{if(live)setChecked(true);});return()=>{live=false;};},[]);
  const run=async(fn:()=>Promise<void>)=>{setError('');setNotice('');setBusy(true);try{await fn();}catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}};
  const downloadChallenge=()=>{if(!challenge)return;const url=URL.createObjectURL(new Blob([challenge.message],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='magazoo-login.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <main className="admin-page">
    <header className="admin-header"><div><a className="admin-brand" href={import.meta.env.BASE_URL}>Magazoo!</a><span>Project library</span></div><nav><a href={import.meta.env.BASE_URL}>Open editor</a>{csrf&&<button disabled={busy} onClick={()=>void run(async()=>{await api('auth/logout',csrf,'POST');setCsrf('');setProjects([]);setChallenge(null);})}>Log out</button>}</nav></header>
    <div className="admin-content">
      <div className="admin-intro"><p className="admin-eyebrow">Publication workspace</p><h1>{csrf?'Your projects, in one place.':'A private workspace for your publications.'}</h1><p>Organise editable Magazoo documents by project and share individual editing links.</p></div>
      {error&&<div className="admin-alert" role="alert">{error}</div>}{notice&&<div className="admin-notice" role="status">{notice}</div>}
      {!checked?<p role="status">Checking admin session…</p>:!csrf?<section className="admin-card admin-login">
        <h2>Sign in with your SSH key</h2><p>No password is stored. Download a one-time challenge, sign it locally with your RSA private key, and upload only the resulting <code>.sig</code> file. Your private key stays on your computer.</p>
        <button className="primary" disabled={busy} onClick={()=>void run(async()=>{setChallenge(await api('auth/challenge','','POST',{}));setSignature('');})}>{challenge?'Start a new challenge':'Create login challenge'}</button>
        {challenge&&<div className="admin-login-steps"><h3>1. Download the challenge</h3><button onClick={downloadChallenge}>Download magazoo-login.txt</button><p>It expires at {new Date(challenge.expires).toLocaleTimeString()}. Use the file unchanged.</p>
          <details><summary>View challenge</summary><pre className="admin-challenge">{challenge.message}</pre></details>
          <h3>2. Sign it on your computer</h3><p>In a terminal, run this command, replacing the key and downloaded-file paths with yours:</p><pre>ssh-keygen -Y sign -n magazoo-admin -f "PATH_TO_YOUR_RSA_PRIVATE_KEY" "PATH_TO/magazoo-login.txt"</pre>
          <h3>3. Upload the signature</h3><label>OpenSSH signature (.sig)<input type="file" accept=".sig" onChange={e=>{const f=e.target.files?.[0];if(f)void run(async()=>{if(f.size>16384)throw new Error('Choose the small .sig file, not a private key.');const value=await f.text();if(!value.startsWith('-----BEGIN SSH SIGNATURE-----'))throw new Error('This is not an SSH signature. Never upload your private key.');setSignature(value);});}} /></label>
          <label>Or paste the .sig file contents<textarea value={signature} rows={4} onChange={e=>{const value=e.target.value;if(!value || (value.length<=16384&&value.startsWith('-----BEGIN SSH SIGNATURE-----'))){setSignature(value);setError('');}else{setSignature('');setError('Paste only the OpenSSH signature. Private keys are not accepted or sent.');}}} /></label>
          <button className="primary" disabled={!signature||busy} onClick={()=>void run(async()=>{const data=await api('auth/login','','POST',{id:challenge.id,signature});setSignature('');setChallenge(null);setCsrf(data.csrf);await refresh(data.csrf);})}>Verify and sign in</button>
        </div>}
      </section>:<>
        <div className="admin-create-grid"><form className="admin-card" onSubmit={e=>{e.preventDefault();void run(async()=>{await api('projects',csrf,'POST',{name});setName('');await refresh();setNotice('Project created.');});}}><h2>Create a project</h2><label>Project name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="School magazine · September 2026" /></label><button className="primary" disabled={busy||!name.trim()}>Create project</button></form>
          <form className="admin-card" onSubmit={e=>{e.preventDefault();void run(async()=>{const doc=upload??emptyDoc();if(!upload)doc.meta.title=itemName.replace(/\.json$/i,'');await api(`projects/${projectId}/documents`,csrf,'POST',{name:itemName,doc});setItemName('');setUpload(null);if(importInput.current)importInput.current.value='';await refresh();setNotice('Document created. Its private editing link is ready below.');});}}><h2>Add a JSON document</h2><label>Project<select required value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Choose a project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>File name<input required value={itemName} maxLength={115} onChange={e=>setItemName(e.target.value)} placeholder="research-highlights.json" /></label><label>Import an existing JSON (optional)<input ref={importInput} type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];setUpload(null);if(!f)return;void run(async()=>{if(f.size>64*1024*1024)throw new Error('File exceeds 64 MB.');setUpload(migrate(JSON.parse(await f.text())));if(!itemName)setItemName(f.name);});}} /></label><button className="primary" disabled={busy||!projectId||!itemName.trim()}>Create document & link</button></form></div>
        <div className="admin-library-title"><h2>Project library <span>{projects.length}</span></h2><button disabled={busy} onClick={()=>void run(()=>refresh())}>Refresh</button></div>
        <p className="admin-sharing-note">Anyone with a private link can read and edit that one document. Treat links like passwords. Edits save automatically; conflicting versions are never silently overwritten.</p>
        {!projects.length&&<section className="admin-card admin-empty"><h3>Your library is ready.</h3><p>Create your first project above, then add its JSON documents.</p></section>}
        {projects.map(p=><section className="admin-card admin-project" key={p.id}><header><div><h3>{p.name}</h3><span>{p.items.length} {p.items.length===1?'document':'documents'}</span></div><button className="danger-quiet" onClick={()=>setDeleting({name:p.name,path:`projects/${p.id}`,project:true})}>Delete project</button></header><ul>{p.items.map(item=><li key={item.id}><div className="admin-item-name"><strong>{item.name}</strong><small>Version {item.version} · {new Date(item.updated).toLocaleString()}</small></div><div className="admin-actions"><a href={sharedLink(item.token)} target="_blank" rel="noreferrer">Edit document ↗</a><button onClick={()=>void run(async()=>{await navigator.clipboard.writeText(sharedLink(item.token));setNotice(`Private editing link copied for ${item.name}.`);})}>Copy private link</button><button className="danger-quiet" aria-label={`Delete ${item.name}`} onClick={()=>setDeleting({name:item.name,path:`documents/${item.id}`,project:false})}>Delete</button></div></li>)}</ul>{!p.items.length&&<p>No documents yet. Add one above.</p>}</section>)}
      </>}
      <footer className="admin-footnote">Keep regular server backups. Deleting a project also revokes every document link inside it.</footer>
    </div>
    {deleting&&<DeleteDialog target={deleting} close={()=>setDeleting(null)} remove={()=>run(async()=>{await api(deleting.path,csrf,'DELETE',{confirmation:deleting.name});setDeleting(null);await refresh();setNotice('Deleted. Affected editing links have been revoked.');})} />}
  </main>;
}
