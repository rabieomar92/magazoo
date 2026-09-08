import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDoc } from '../schema/document';
import { useDoc } from './useDoc';
import { bindTarget, saveToTarget, useProjectFile, type ProjectFileHandle } from './projectFiles';
afterEach(()=>{bindTarget(null,null);vi.unstubAllGlobals();});
function fileHandle(){
  let modified=1;const writes:Blob[]=[];
  const handle:ProjectFileHandle={name:'test.json',getFile:async()=>new File([''], 'test.json',{lastModified:modified}),queryPermission:async()=>'granted',createWritable:async()=>({write:async b=>{writes.push(b);},close:async()=>{modified++;}})};
  return{handle,writes,externalChange:()=>modified++};
}
describe('document save targets',()=>{
  it('keeps unsaved drafts unbound without starting downloads',async()=>{
    bindTarget(null,null);await saveToTarget(emptyDoc());expect(useProjectFile.getState().status).toBe('draft');
  });
  it('writes sequential snapshots into the selected file and skips the already saved snapshot',async()=>{
    const{handle,writes}=fileHandle();const doc=emptyDoc();doc.meta.title='Initial';useDoc.getState().load(doc);bindTarget({kind:'file',handle,modified:1},null);
    await saveToTarget(doc);await saveToTarget(doc);expect(writes).toHaveLength(1);expect(useProjectFile.getState().status).toBe('saved');
    const next={...doc,meta:{...doc.meta,title:'Next'}};useDoc.getState().load(next);await saveToTarget(next);expect(writes).toHaveLength(2);
  });
  it('rejects external file modifications',async()=>{
    const{handle,writes,externalChange}=fileHandle();bindTarget({kind:'file',handle,modified:1},null);externalChange();
    await expect(saveToTarget(emptyDoc())).rejects.toThrow('changed outside');expect(writes).toHaveLength(0);expect(useProjectFile.getState().status).toBe('conflict');
  });
  it('never sends a queued old snapshot to a newly selected file',async()=>{
    const first=fileHandle(),second=fileHandle();bindTarget({kind:'file',handle:first.handle,modified:1},null);
    const operation=saveToTarget(emptyDoc());bindTarget({kind:'file',handle:second.handle,modified:1},null);await operation;
    expect(first.writes).toHaveLength(0);expect(second.writes).toHaveLength(0);
  });
  it('surfaces write failures rather than reporting saved',async()=>{
    const{handle}=fileHandle();handle.createWritable=async()=>{throw new Error('disk full');};bindTarget({kind:'file',handle,modified:1},null);
    await expect(saveToTarget(emptyDoc())).rejects.toThrow('disk full');expect(useProjectFile.getState().status).toBe('error');
  });
  it('uses versioned online writes and preserves edits on a conflict',async()=>{
    const fetch=vi.fn().mockResolvedValue({status:409,ok:false});vi.stubGlobal('fetch',fetch);
    const doc=emptyDoc();useDoc.getState().load(doc);bindTarget({kind:'online',token:'a'.repeat(43),version:7,name:'online.json'},null);
    await expect(saveToTarget(doc)).rejects.toThrow('newer version');expect(fetch.mock.calls[0][1].headers['If-Match']).toBe('7');
    expect(useDoc.getState().doc).toBe(doc);expect(useProjectFile.getState().status).toBe('conflict');
    await saveToTarget(doc);expect(fetch).toHaveBeenCalledTimes(1);
  });
});
