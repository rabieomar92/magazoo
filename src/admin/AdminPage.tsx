import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { emptyDoc, migrate, type Doc } from '../schema/document';
import '../styles/admin.css';
import AdminLibrary, { type DeleteTarget } from './AdminLibrary';
import type { LibraryProject } from './libraryModel';
import RenameProjectDialog from './RenameProjectDialog';
import { AdminIcon } from './AdminIcon';
import { Wordmark } from '../components/Wordmark';
import { MagazooLoader } from '../components/MagazooLoader';
import {LoginBackground} from './LoginBackground';
import {PasswordDialog} from './PasswordDialog';
const IssueWorkspace = lazy(() => import('../issue/IssueWorkspace'));

const api = async (path: string, csrf: string, method = 'GET', data?: unknown) => {
  const response = await fetch(`${import.meta.env.BASE_URL}api/${path}`, {method, signal: AbortSignal.timeout(60000), headers: {'Content-Type':'application/json','X-CSRF-Token':csrf}, body:data === undefined ? undefined : JSON.stringify(data)});
  const result = await response.json().catch(() => { throw new Error('The server returned an unexpected response. Please refresh and try again.'); });
  if (!response.ok) throw new Error(result.error ?? 'Request failed.');
  return result;
};
const sharedLink = (token: string) => `${location.origin}${import.meta.env.BASE_URL}#edit=${token}`;

function DeleteDialog({target, close, remove}: {target: DeleteTarget; close: () => void; remove: () => Promise<void>}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="admin-dialog" onCancel={event => { if (busy) event.preventDefault(); else close(); }} aria-labelledby="delete-title">
    <h2 id="delete-title">Delete {target.project ? 'project' : 'document'}?</h2>
    <p>{target.project ? 'This deletes every JSON document in this project.' : 'This deletes the JSON document.'} All affected sharing links will stop working. This cannot be undone here; download any copies you need first.</p>
    <label>Type <strong>{target.name}</strong> to confirm<input autoFocus value={text} disabled={busy} onChange={e => setText(e.target.value)} autoComplete="off" /></label>
    <div className="admin-actions"><button onClick={close} disabled={busy}>Cancel</button><button className="danger" disabled={text !== target.name || busy} onClick={() => { setBusy(true); void remove().finally(() => setBusy(false)); }}>{busy ? 'Deleting…' : 'Permanently delete'}</button></div>
  </dialog>;
}

export default function AdminPage() {
  const [compilingProject, setCompilingProject] = useState<string | null>(null);
  const [csrf, setCsrf] = useState('');
  const [checked, setChecked] = useState(false);
  const [projects, setProjects] = useState<LibraryProject[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordSettings,setPasswordSettings]=useState(false);
  const [name, setName] = useState('');
  const [itemName, setItemName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [upload, setUpload] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [renaming, setRenaming] = useState<LibraryProject | null>(null);
  const [creator, setCreator] = useState<'project' | 'article' | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const creatorRef = useRef<HTMLElement>(null);
  const creatorTrigger = useRef<HTMLButtonElement | null>(null);
  const closeCreator = () => { setCreator(null); };
  useEffect(() => {
    if (creator) creatorRef.current?.querySelector<HTMLInputElement>('form:not([hidden]) input:not([type=file])')?.focus();
  }, [creator]);
  useEffect(() => {
    if (!creator && !busy && creatorTrigger.current) {
      creatorTrigger.current.focus();
      creatorTrigger.current = null;
    }
  }, [creator, busy]);
  const refresh = async (key = csrf) => {
    const list = await api('projects', key);
    setProjects(list);
    setProjectId(current => list.some((p: LibraryProject) => p.id === current) ? current : list[0]?.id ?? '');
  };
  useEffect(() => {
    let live = true;
    void api('auth/session', '').then(async data => { if (live) { setCsrf(data.csrf); await refresh(data.csrf); } }).catch(() => {}).finally(() => { if (live) setChecked(true); });
    return () => { live = false; };
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setError(''); setNotice(''); setBusy(true);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); }
    finally { setBusy(false); }
  };
  const count = projects.reduce((total, project) => total + project.items.length, 0);
  if (csrf && compilingProject) return <Suspense fallback={<MagazooLoader label="Opening issue studio…" detail="Preparing the issue compiler and saved arrangement." />}><IssueWorkspace projectId={compilingProject} csrf={csrf} onClose={() => { setCompilingProject(null); void run(() => refresh()); }} /></Suspense>;
  return <main className={`admin-page${!csrf?' admin-page--signin':''}`}>
    {csrf&&busy && <div className="admin-loading"><MagazooLoader variant="banner" label="Working… Please wait." /></div>}
    {csrf&&<header className="admin-header">
      <div className="admin-header-identity"><a className="admin-brand" href={`${import.meta.env.BASE_URL}#admin`} aria-label="Magazoo admin home"><Wordmark /></a><span className="admin-header-divider"/><div className="admin-workspace-name"><strong>Editorial workspace</strong><span>Magazoo! Studio</span></div></div>
      <nav aria-label="Workspace"><a href={`${import.meta.env.BASE_URL}#editor`}>Open editor<AdminIcon name="arrow"/></a>{csrf && <><span className="admin-role"><span/>Administrator</span><button disabled={busy} onClick={()=>setPasswordSettings(true)}>Change password</button><button disabled={busy} onClick={() => void run(async () => { await api('auth/logout', csrf, 'POST'); setCsrf(''); setProjects([]); setCreator(null); })}>Log out</button></>}</nav>
    </header>}
    <div className={`admin-content${!csrf?' admin-content--signin':''}`}>
      {csrf&&<div className="admin-intro">
        <div><h1>Article library</h1></div>
        {csrf && <div className="admin-intro-actions"><button disabled={busy} aria-expanded={creator === 'project'} aria-controls="admin-create-panel" onClick={e => { creatorTrigger.current = e.currentTarget; setCreator('project'); }}><AdminIcon name="folder"/>New project</button><button className="primary" disabled={busy || !projects.length} aria-expanded={creator === 'article'} aria-controls="admin-create-panel" onClick={e => { creatorTrigger.current = e.currentTarget; setCreator('article'); }}><AdminIcon name="plus"/>Add article</button></div>}
      </div>}
      {csrf&&error && <div className="admin-alert" role="alert">{error}</div>}{csrf&&notice && <div className="admin-notice" role="status">{notice}</div>}
      {!csrf ? <div className="admin-login-layout"><LoginBackground enabled={checked}/><section className="admin-card admin-login" aria-labelledby="admin-login-title">
        <div className="admin-login-brand"><Wordmark/></div><h1 id="admin-login-title">Sign in</h1><p>Administrator access</p>
        {error&&<div className="admin-alert" role="alert">{error}</div>}
        <div className="admin-login-auth" aria-busy={!checked||busy}>{!checked?<p className="admin-login-check" role="status">Checking admin session…</p>:<form onSubmit={e => { e.preventDefault(); void run(async () => { const data = await api('auth/login', '', 'POST', {password}); setPassword(''); setPasswordVisible(false); setCsrf(data.csrf); await refresh(data.csrf); setNotice('Signed in.'); }); }}>
          <label htmlFor="admin-login-password">Administrator password</label><div className="admin-login-password"><input id="admin-login-password" type={passwordVisible?'text':'password'} required minLength={8} maxLength={512} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" autoFocus disabled={busy}/><button className="admin-login-reveal" type="button" disabled={busy} aria-label={passwordVisible?'Hide password':'Show password'} aria-pressed={passwordVisible} onClick={()=>setPasswordVisible(value=>!value)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{passwordVisible&&<path d="m3 3 18 18"/>}</svg></button></div>
          <button className="primary" disabled={busy || password.length < 8}>{busy ? 'Signing in…' : 'Sign in to workspace'}<AdminIcon name="arrow"/></button>
        </form>}</div>
        <a className="admin-login-editor" href={`${import.meta.env.BASE_URL}#editor`}>Open editor<AdminIcon name="arrow"/></a>
      </section></div> : <>
        <div className="admin-overview" aria-label="Library overview">
          <div><span className="admin-stat-icon"><AdminIcon name="article"/></span><div><strong>{count}</strong><span>{count === 1 ? 'Article' : 'Articles'}</span></div></div>
          <div><span className="admin-stat-icon"><AdminIcon name="folder"/></span><div><strong>{projects.length}</strong><span>{projects.length === 1 ? 'Project' : 'Projects'}</span></div></div>
          <div className="admin-overview-note"><AdminIcon name="shield"/><div><strong>One editor at a time</strong><span>Other visitors have read-only access.</span></div></div>
        </div>
        <section id="admin-create-panel" ref={creatorRef} className="admin-card admin-create-panel" hidden={!creator} aria-labelledby="admin-create-title">
          <header><div><h2 id="admin-create-title">{creator === 'project' ? 'Create a project' : 'Add an article'}</h2><p>{creator === 'project' ? 'Group articles in a named project.' : 'Create a blank document or import a Magazoo JSON file.'}</p></div><button className="admin-icon-button" disabled={busy} aria-label="Close create panel" onClick={closeCreator}><AdminIcon name="close"/></button></header>
          <form hidden={creator !== 'project'} onSubmit={e => { e.preventDefault(); void run(async () => { const created = await api('projects', csrf, 'POST', {name}); setName(''); await refresh(); setProjectId(created.id); closeCreator(); setNotice('Project created. Add an article when you are ready.'); }); }}>
            <fieldset disabled={busy}><label>Project name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="School magazine · September 2026" /></label><button className="primary" disabled={busy || !name.trim()}><AdminIcon name="plus"/>Create project</button></fieldset>
          </form>
          <form hidden={creator !== 'article'} onSubmit={e => { e.preventDefault(); void run(async () => { const doc = upload ?? emptyDoc(); if (!upload) doc.meta.title = itemName.replace(/\.json$/i, ''); await api(`projects/${projectId}/documents`, csrf, 'POST', {name:itemName, doc}); setItemName(''); setUpload(null); if (importInput.current) importInput.current.value = ''; await refresh(); closeCreator(); setNotice('Article created. Its private editing link is ready in the library.'); }); }}>
            <fieldset disabled={busy}><div className="admin-create-fields"><label>Project<select required value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Choose a project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>File name<input required value={itemName} maxLength={115} onChange={e => setItemName(e.target.value)} placeholder="research-highlights.json" /></label><label className="admin-upload">Import existing JSON <span className="admin-optional">Optional · up to 64 MB</span><input ref={importInput} type="file" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; setUpload(null); if (!f) return; void run(async () => { if (f.size > 64 * 1024 * 1024) throw new Error('File exceeds 64 MB.'); setUpload(migrate(JSON.parse(await f.text()))); if (!itemName) setItemName(f.name); }); }} /></label></div><button className="primary" disabled={busy || !projectId || !itemName.trim()}><AdminIcon name="plus"/>Create document &amp; link</button></fieldset>
          </form>
        </section>
        <div className="admin-library-title"><div><h2>All articles</h2></div><button disabled={busy} onClick={() => void run(() => refresh())}><AdminIcon name="refresh"/>Refresh</button></div>
        <AdminLibrary projects={projects} busy={busy} onDelete={setDeleting} onRename={setRenaming} onCompile={setCompilingProject} link={sharedLink} onCopy={item => void run(async () => { await navigator.clipboard.writeText(sharedLink(item.token)); setNotice(`Private editing link copied for ${item.name}.`); })} />
        <aside className="admin-sharing-note"><AdminIcon name="shield"/><p>Share thoughtfully. Anyone with a private link can access that article; only one person can edit it at a time. Keep links with your editorial team.</p></aside>
      </>}
      {csrf&&<footer className="admin-footnote"><span>Keep regular server backups. Deleting a project revokes its article links.</span></footer>}
    </div>
    {csrf&&passwordSettings&&<PasswordDialog close={()=>setPasswordSettings(false)} save={async data=>{const renewed=await api('auth/password',csrf,'POST',data);setCsrf(renewed.csrf);setNotice('Password changed. Other administrator sessions have been signed out.');}}/>}
    {deleting && <DeleteDialog target={deleting} close={() => setDeleting(null)} remove={() => run(async () => { await api(deleting.path, csrf, 'DELETE', {confirmation:deleting.name}); setDeleting(null); await refresh(); setNotice('Deleted. Affected editing links have been revoked.'); })} />}
    {renaming && <RenameProjectDialog name={renaming.name} close={() => setRenaming(null)} rename={async name => { await api(`projects/${renaming.id}`, csrf, 'PATCH', {name, previousName:renaming.name}); setRenaming(null); await run(async () => { await refresh(); setNotice('Project renamed. Existing editing links are unchanged.'); }); }} />}
  </main>;
}
