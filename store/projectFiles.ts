import { create } from 'zustand';
import type { Doc } from '../schema/document';
import { migrate } from '../schema/document';
import { useDoc } from './useDoc';
import { serializeDocument } from '../lib/serializeDocument';

export interface ProjectFileHandle {
  name: string;
  getFile(): Promise<File>;
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
}
export interface LocalTarget { kind:'file'; handle:ProjectFileHandle; modified:number; }
export interface RemoteTarget { kind:'online'; token:string; version:number; name:string; }
export type SaveTarget = LocalTarget | RemoteTarget;
type Status = 'draft' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';
export const useProjectFile = create<{
  target:SaveTarget|null; status:Status; message:string; savedDoc:Doc|null;
}>(() => ({ target:null, status:'draft', message:'Draft — choose Save As to save a file', savedDoc:null }));
let pending: Promise<void> = Promise.resolve();
let generation = 0;

export function bindTarget(target:SaveTarget|null, savedDoc:Doc|null) {
  generation++;
  useProjectFile.setState({ target, savedDoc, status:target ? 'saved':'draft', message:target ? `Saved · ${target.kind === 'file' ? target.handle.name : target.name}` : 'Draft — choose Save As to save a file' });
}
export function markProjectDirty() {
  const state = useProjectFile.getState();
  if (state.status === 'conflict' || state.status === 'error') return;
  useProjectFile.setState({ status:state.target ? 'pending':'draft', message:state.target ? 'Changes waiting to save…' : 'Draft — choose Save As to save a file' });
}
export class SaveConflict extends Error {}

/** Serial writes with a generation guard: delayed writes can never follow a
 * user into a different file. HTTP versions and file timestamps reject stale
 * overwrites instead of silently losing another editor's changes. */
export function saveToTarget(doc = useDoc.getState().doc, explicit = false): Promise<void> {
  const snapshot = useProjectFile.getState();
  const epoch = generation;
  if (!snapshot.target || snapshot.savedDoc === doc) return Promise.resolve();
  const task = pending.catch(() => {}).then(async () => {
    if (generation !== epoch) return;
    const state = useProjectFile.getState();
    // Autosave calls this function without an explicit snapshot. Resolve the
    // document only after earlier queued writes have finished so a highlight
    // drag (or any other quick edit) cannot be replaced by an older snapshot.
    let docToSave = explicit ? doc : useDoc.getState().doc;
    if ((!explicit && (state.status === 'error' || state.status === 'conflict')) || state.savedDoc === docToSave) return;
    const target = state.target!;
    useProjectFile.setState({ status:'saving', message:'Saving…' });
    try {
      let json = await serializeDocument(docToSave);
      // Serialisation can take a while when a project contains large images.
      // If the editor changed during that window, serialise the newest
      // immutable snapshot before writing it. This guard applies to manual
      // saves as well as autosave, so a save cannot report success for bytes
      // that predate a just-finished edit. The autosave subscription still
      // marks any edit during this second pass as pending for a later flush.
      const latest = useDoc.getState().doc;
      if (latest !== docToSave) {
        json = await serializeDocument(latest);
        // Keep the snapshot represented by the bytes we are about to write.
        // This also makes savedDoc a reliable dirty-check after the write.
        docToSave = latest;
      }
      if (generation !== epoch) return;
      if (target.kind === 'file') {
        const permission = await target.handle.queryPermission?.({mode:'readwrite'});
        if (permission && permission !== 'granted') throw new Error('Click Save to reconnect this file, or choose Save As.');
        const current = await target.handle.getFile();
        if (target.modified && current.lastModified !== target.modified) throw new SaveConflict('This file changed outside Magazoo. Use Save As to keep your edits in another file.');
        const writer = await target.handle.createWritable();
        try { await writer.write(new Blob([json],{type:'application/json'})); await writer.close(); }
        catch (error) { await writer.abort?.().catch(() => {}); throw error; }
        target.modified = (await target.handle.getFile()).lastModified;
      } else {
        const response = await fetch(`${import.meta.env.BASE_URL}api/documents/shared`, {
          method:'PUT', headers:{'Content-Type':'application/json','Authorization':`Bearer ${target.token}`,'If-Match':String(target.version)}, body:json,
        });
        if (response.status === 409) throw new SaveConflict('Someone else saved a newer version. Your edits are kept here. Save a copy before reopening the link; no changes were overwritten.');
        if (!response.ok) throw new Error(response.status === 404 ? 'This shared document was removed or its link is no longer valid. Save a local copy.' : 'Online save failed. Your edits are kept in this browser. Check the connection and click Save to retry.');
        target.version = (await response.json()).version;
      }
      if (generation === epoch) useProjectFile.setState({ target:{...target}, savedDoc:docToSave,
        status:useDoc.getState().doc === docToSave ? 'saved':'pending', message:useDoc.getState().doc === docToSave ? `Saved · ${target.kind === 'file' ? target.handle.name : target.name}`:'Changes waiting to save…' });
    } catch (error) {
      if (generation === epoch) useProjectFile.setState({status:error instanceof SaveConflict ? 'conflict':'error',message:error instanceof Error ? error.message:'Save failed. Please save a copy.'});
      throw error;
    }
  });
  pending = task;
  return task;
}

type PickerWindow = Window & {
  showSaveFilePicker?: (options:unknown) => Promise<ProjectFileHandle>;
  showOpenFilePicker?: (options:unknown) => Promise<ProjectFileHandle[]>;
};
const types = [{ description:'Magazoo project', accept:{ 'application/json':['.json'] } }];
const cancelled = (error:unknown) => error instanceof DOMException && error.name === 'AbortError';
export async function downloadCopy(doc = useDoc.getState().doc) {
  const url = URL.createObjectURL(new Blob([await serializeDocument(doc)],{type:'application/json'}));
  const link = document.createElement('a'); link.href=url; link.download='magazoo-project.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
export async function saveProjectAs() {
  const picker = (window as PickerWindow).showSaveFilePicker;
  if (!picker) { await downloadCopy(); alert('A copy was downloaded. This browser cannot automatically update a downloaded file. Your draft is still backed up in this browser.'); return; }
  try {
    const name=Array.from(useDoc.getState().doc.meta.title || 'Magazoo project',c=>c.charCodeAt(0)<32?'-':c).join('').replace(/[<>:"/\\|?*]/g,'-').slice(0,100);
    const handle=await picker.call(window,{ suggestedName:`${name}.json`,types });
    await pending.catch(() => {});
    const old=useProjectFile.getState();
    bindTarget({kind:'file',handle,modified:0},null);
    try { await saveToTarget(useDoc.getState().doc,true); if(old.target?.kind==='online')history.replaceState(null,'',location.pathname); }
    catch (error) { bindTarget(old.target,old.savedDoc); throw error; }
  } catch(error) { if (!cancelled(error)) alert(error instanceof Error ? error.message : 'Could not save the file.'); }
}
export async function saveProject() {
  const {target,status}=useProjectFile.getState();
  if (!target) return saveProjectAs();
  if (status==='conflict') { alert(useProjectFile.getState().message); return; }
  try {
    if (target.kind==='file') await target.handle.requestPermission?.({mode:'readwrite'});
    await saveToTarget(useDoc.getState().doc,true);
  } catch(error) { alert(error instanceof Error ? error.message : 'Save failed.'); }
}
export async function openProject() {
  const state=useProjectFile.getState();
  if (state.status !== 'saved' && !confirm('Open another project? Save your current work first if you need to keep it.')) return;
  const load = async (file:File,handle?:ProjectFileHandle) => {
    const doc=migrate(JSON.parse(await file.text()));
    await pending.catch(() => {});
    useDoc.getState().load(doc);
    bindTarget(handle ? {kind:'file',handle,modified:file.lastModified}:null,doc);
    if(location.hash.startsWith('#edit='))history.replaceState(null,'',location.pathname);
  };
  try {
    const picker=(window as PickerWindow).showOpenFilePicker;
    if(picker) { const [handle]=await picker.call(window,{types,multiple:false}); if(handle) await load(await handle.getFile(),handle); }
    else {
      const input=document.createElement('input'); input.type='file';input.accept='.json,application/json';
      input.onchange=()=>{const file=input.files?.[0];if(file) void load(file).catch(()=>alert('Invalid project file.'));};input.click();
    }
  } catch(error) { if(!cancelled(error)) alert('Could not open this project. Your current work was not replaced.'); }
}
