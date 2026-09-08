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
  it('writes the complete highlights payload, including a manually placed box',async()=>{
    const{handle,writes}=fileHandle();
    const doc=emptyDoc();
    doc.design.highlightsPlacement='free';
    doc.highlights=['A saved highlight'];
    doc.references=[{id:'ref-1',authors:'A. Researcher',title:'A result',journal:'Journal',year:'2026',doi:'10.0000/example'}];
    doc.highlightBox={widthCols:2,anchor:{page:2,column:1,y:137.25}};
    useDoc.getState().load(doc);
    bindTarget({kind:'file',handle,modified:1},null);

    await saveToTarget(doc);

    const saved=JSON.parse(await writes[0].text()) as typeof doc;
    expect(saved.design.highlightsPlacement).toBe('free');
    expect(saved.highlights).toEqual(['A saved highlight']);
    expect(saved.references).toHaveLength(1);
    expect(saved.highlightBox).toEqual(doc.highlightBox);
  });
  it('uses the newest snapshot when another edit arrives behind a queued save',async()=>{
    let modified=1;
    const writes:Blob[]=[];
    let releaseFirstWrite!:()=>void;
    const firstWriteFinished=new Promise<void>(resolve=>{releaseFirstWrite=resolve;});
    let firstWriteStarted!:()=>void;
    const firstWriteSeen=new Promise<void>(resolve=>{firstWriteStarted=resolve;});
    const handle:ProjectFileHandle={
      name:'queued.json',
      getFile:async()=>new File([''], 'queued.json',{lastModified:modified}),
      queryPermission:async()=>'granted',
      createWritable:async()=>({
        write:async(data)=>{
          writes.push(data);
          if(writes.length===1){ firstWriteStarted(); await firstWriteFinished; }
        },
        close:async()=>{modified+=1;},
      }),
    };
    const first=emptyDoc();
    first.meta.title='First';
    useDoc.getState().load(first);
    bindTarget({kind:'file',handle,modified:1},null);
    const firstSave=saveToTarget();
    await firstWriteSeen;

    const latest={...first,meta:{...first.meta,title:'Latest'},highlightBox:{widthCols:1,anchor:{page:1,column:2,y:90}} as const};
    useDoc.getState().load(latest);
    const secondSave=saveToTarget();
    releaseFirstWrite();
    await Promise.all([firstSave,secondSave]);

    expect(writes).toHaveLength(2);
    expect(JSON.parse(await writes[1].text())).toEqual(expect.objectContaining({
      meta:expect.objectContaining({title:'Latest'}),
      highlightBox:latest.highlightBox,
    }));
    expect(useProjectFile.getState().savedDoc).toBe(latest);
  });
  it('includes highlights and their placement in an online save body',async()=>{
    const fetch=vi.fn().mockResolvedValue({status:200,ok:true,json:async()=>({version:9})});
    vi.stubGlobal('fetch',fetch);
    const doc=emptyDoc();
    doc.design.highlightsPlacement='free';
    doc.highlights=['Online highlight'];
    doc.highlightBox={widthCols:1,anchor:{page:1,column:3,y:72}};
    useDoc.getState().load(doc);
    bindTarget({kind:'online',token:'a'.repeat(43),version:8,name:'online.json'},null);

    await saveToTarget(doc);

    const request=fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body)).highlightBox).toEqual(doc.highlightBox);
    expect(useProjectFile.getState().target).toEqual(expect.objectContaining({version:9}));
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
