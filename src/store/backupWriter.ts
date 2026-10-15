import type { Doc } from '../schema/document';
import type { SaveTarget } from './projectFiles';

export interface BackupSnapshot { doc:Doc; target:SaveTarget|null; pending:boolean }
const keyOf = ({target}:BackupSnapshot) => target?.kind === 'online' ? `online:${target.token}` : 'current';
function sameTarget(a:SaveTarget|null,b:SaveTarget|null) {
  if (!a || !b) return a === b;
  if (a.kind === 'online' && b.kind === 'online') return a.token === b.token && a.version === b.version && a.name === b.name;
  return a.kind === 'file' && b.kind === 'file' && a.handle === b.handle && a.modified === b.modified;
}
const same = (a:BackupSnapshot|undefined,b:BackupSnapshot) => a?.doc === b.doc && a.pending === b.pending && sameTarget(a.target,b.target);

/** One write in flight, at most one newest checkpoint per recovery session.
 * Document snapshots are immutable; copying target metadata prevents a later
 * server acknowledgement from changing the version of an earlier checkpoint. */
export function createBackupWriter(write:(doc:Doc,target:SaveTarget|null,pending:boolean)=>Promise<unknown>) {
  const queued = new Map<string,BackupSnapshot>();
  let running:Promise<void>|undefined;
  let last:BackupSnapshot|undefined;
  return (snapshot:BackupSnapshot):Promise<void> => {
    const captured = {...snapshot,target:snapshot.target ? {...snapshot.target} : null};
    queued.set(keyOf(captured),captured);
    if (!running) running = Promise.resolve().then(async()=>{
      while (queued.size) {
        const [key,next] = queued.entries().next().value!;
        queued.delete(key);
        if (same(last,next)) continue;
        await write(next.doc,next.target,next.pending);
        last=next;
      }
    }).finally(()=>{running=undefined;});
    return running;
  };
}
