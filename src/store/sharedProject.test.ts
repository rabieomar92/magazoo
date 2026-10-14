import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDoc } from '../schema/document';
import { loadSharedProject } from './sharedProject';
import { useDoc } from './useDoc';
import { bindTarget, useProjectFile } from './projectFiles';
import { useEditLease } from './editLease';
import { loadSession } from './db';
vi.mock('./db',()=>({loadSession:vi.fn(),saveDoc:vi.fn()}));
const token='a'.repeat(43);
const latest=()=>({name:'Test.json',doc:emptyDoc(),version:2,validForMs:180000});
beforeEach(()=>{vi.mocked(loadSession).mockResolvedValue(undefined);bindTarget(null,null);useDoc.getState().load(emptyDoc());useEditLease.setState({status:'local',token:undefined,leaseId:undefined,deadline:0});});
afterEach(()=>vi.unstubAllGlobals());
describe('shared document loading and recovery',()=>{
  it('loads the atomically acquired latest version before allowing saves',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>latest()}));
    await loadSharedProject(token);
    expect(useEditLease.getState().status).toBe('active');expect(useProjectFile.getState().target).toMatchObject({kind:'online',version:2});expect(useProjectFile.getState().savedDoc).toBe(useDoc.getState().doc);
  });
  it('loads a blocked reader without binding a save target',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce({ok:false,status:423,json:async()=>({error:'Another editor'})}).mockResolvedValueOnce({ok:true,json:async()=>latest()});vi.stubGlobal('fetch',fetch);
    await loadSharedProject(token);expect(useEditLease.getState().status).toBe('blocked');expect(useProjectFile.getState().target).toBeNull();
  });
  it('does not acquire from an already cancelled boot (React StrictMode)',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await loadSharedProject(token,()=>true);expect(fetch).not.toHaveBeenCalled();
  });
  it('releases a reservation if loading its document fails',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({...latest(),doc:{schemaVersion:99}})}).mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal('fetch',fetch);
    await expect(loadSharedProject(token)).rejects.toThrow();expect(useEditLease.getState().status).toBe('error');expect(JSON.parse(fetch.mock.calls.at(-1)![1].body).action).toBe('release');
  });
  it('preserves stale unsaved work without overwriting the newer server document',async()=>{
    const draft=emptyDoc();draft.meta.title='My unsaved work';
    vi.mocked(loadSession).mockResolvedValue({id:`online:${token}`,doc:draft,savedAt:0,pending:true,target:{kind:'online',name:'Test.json',token,version:1}});
    const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>latest()}).mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal('fetch',fetch);
    await loadSharedProject(token);expect(useEditLease.getState().status).toBe('recovery');expect(useProjectFile.getState().status).toBe('conflict');expect(useDoc.getState().doc.meta.title).toBe('My unsaved work');
    expect(fetch.mock.calls.some(c=>c[1].method==='PUT')).toBe(false);
    fetch.mockResolvedValue({ok:true,json:async()=>latest()});await loadSharedProject(token,()=>false,true);
    expect(useEditLease.getState().status).toBe('active');expect(useDoc.getState().doc.meta.title).not.toBe('My unsaved work');
  });
  it('keeps a newer in-memory draft ahead of an older backup when reconnecting',async()=>{
    const old=emptyDoc();const current={...old,meta:{...old.meta,title:'Newest typing'}};
    bindTarget({kind:'online',token,version:2,name:'Test.json'},old);useDoc.getState().load(current);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>latest()}));
    await loadSharedProject(token);expect(useDoc.getState().doc.meta.title).toBe('Newest typing');expect(useProjectFile.getState().savedDoc).toBeNull();
  });
});
