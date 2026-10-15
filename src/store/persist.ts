import { useDoc } from './useDoc';
import { migrate, type Doc } from '../schema/document';
import { loadDoc, loadSession, saveDoc } from './db';
import { useSaveStatus } from './saveStatus';
import { bindTarget, markProjectDirty, saveToTarget, useProjectFile } from './projectFiles';
import { createBackupWriter } from './backupWriter';

/**
 * Persistence lives outside the store: it subscribes to useDoc rather than
 * being baked into it, so useDoc.ts stays untouched (house rule).
 */

export type HydrateResult = 'restored' | 'empty' | 'error';

/**
 * Pull the last document out of storage into the store.
 *
 * `reader` is injectable so the decision logic can be tested without a real
 * IndexedDB (same trick paginate() uses with isOverflowing).
 *
 *  - 'restored'  a stored doc was read and loaded
 *  - 'empty'     clean first run, or a stored-but-unsupported version — safe to seed a sample
 *  - 'error'     the read itself failed; the caller must NOT seed/overwrite, or a
 *                real (temporarily unreadable) doc gets clobbered by the next autosave
 */
export async function hydrate(reader: () => Promise<Doc | null> = loadDoc): Promise<HydrateResult> {
  let raw: Doc | null;
  try {
    raw = await reader();
  } catch {
    // Storage read failed — distinct from an empty store. Don't pretend it's blank.
    return 'error';
  }
  if (!raw) return 'empty';
  try {
    const doc=migrate(raw);
    if(reader===loadDoc) {
      const session=await loadSession();
      bindTarget(session?.target ?? null, session?.pending ? null : doc);
    }
    useDoc.getState().load(doc);
    return 'restored';
  } catch {
    // Unknown/unsupported schema version — nothing to restore, but the store is
    // intact and seeding a sample is fine.
    return 'empty';
  }
}

/**
 * Mirror every store change to IndexedDB, debounced so a burst of keystrokes
 * writes once. Returns an unsubscribe for effect cleanup.
 */
export function startAutosave(delay = 1200): () => void {
  let t: ReturnType<typeof setTimeout>|undefined;
  let stopped=false;
  let sawEdit=false;
  let flushing:Promise<void>|undefined;
  let flushAgain=false;
  let backupScheduled=false;
  const { setStatus } = useSaveStatus.getState();
  const writeBackup=createBackupWriter(saveDoc);
  const backUp=async () => {
    const {target,savedDoc}=useProjectFile.getState();
    const doc=useDoc.getState().doc;
    await writeBackup({doc,target,pending:savedDoc!==doc});
    return doc;
  };
  const reportError=()=>{if(!stopped)setStatus('error');};
  const schedule=()=>{clearTimeout(t);t=setTimeout(()=>void flush(),delay);};
  const flush=():Promise<void> => {
    clearTimeout(t);
    if (stopped) return Promise.resolve();
    if (flushing) {flushAgain=true;return flushing;}
    flushing=(async()=>{
      try {
        await backUp();
        if(stopped)return;
        await saveToTarget();
        const saved=await backUp();
        if(!stopped&&saved===useDoc.getState().doc)setStatus('saved');
      } catch { reportError(); }
    })().finally(()=>{
      flushing=undefined;
      if(flushAgain&&!stopped){flushAgain=false;schedule();}
    });
    return flushing;
  };
  const unsubscribe = useDoc.subscribe((state,previous) => {
    if(state.doc===previous.doc) return;
    sawEdit=true;
    markProjectDirty();
    setStatus('saving');
    schedule();
  });
  const unbind=useProjectFile.subscribe((next,previous)=>{
    if(next.savedDoc===previous.savedDoc && next.target===previous.target || backupScheduled)return;
    // Binding a document and loading it are synchronous adjacent operations.
    // Read the settled state rather than backing up the previous article under
    // the new article's recovery key. Coalesce acknowledgements in that turn.
    backupScheduled=true;
    queueMicrotask(()=>{backupScheduled=false;if(!stopped)void backUp().catch(reportError);});
  });
  const hidden=()=>{if(document.visibilityState==='hidden') void flush();};
  const beforeUnload=(event:BeforeUnloadEvent)=>{
    const state=useProjectFile.getState();
    if(state.target && state.savedDoc!==useDoc.getState().doc){event.preventDefault();event.returnValue='';}
  };
  document.addEventListener('visibilitychange',hidden);
  window.addEventListener('beforeunload',beforeUnload);
  if(useProjectFile.getState().target && !useProjectFile.getState().savedDoc) schedule();
  return () => {
    stopped=true;
    clearTimeout(t);
    if(sawEdit||useProjectFile.getState().target?.kind==='online' && useProjectFile.getState().savedDoc!==useDoc.getState().doc)void backUp().catch(()=>{});
    unsubscribe();
    unbind();
    document.removeEventListener('visibilitychange',hidden);
    window.removeEventListener('beforeunload',beforeUnload);
  };
}
