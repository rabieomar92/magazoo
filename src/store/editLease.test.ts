import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireEditLease, editLeaseId, maintainEditLease, releaseEditLease, releaseOwnedLease, useEditLease } from './editLease';
const token='a'.repeat(43);
const ok=(data:unknown={validForMs:180000})=>({ok:true,json:async()=>data});
beforeEach(()=>{vi.useFakeTimers();useEditLease.setState({status:'local',token:undefined,leaseId:undefined,deadline:0,message:''});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('client editing reservation',()=>{
  it('acquires a private per-tab lease and refuses expired or wrong-document saves',async()=>{
    const fetch=vi.fn().mockResolvedValue(ok());vi.stubGlobal('fetch',fetch);
    await acquireEditLease(token);const id=editLeaseId(token);
    expect(id).toMatch(/^[\w-]{36}$/);expect(()=>editLeaseId('other')).toThrow();
    vi.advanceTimersByTime(180000);expect(()=>editLeaseId(token)).toThrow();
  });
  it('blocks on a server reservation conflict',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:423,json:async()=>({error:'Already editing'})}));
    await expect(acquireEditLease(token)).rejects.toThrow('Already editing');
    expect(useEditLease.getState().status).toBe('blocked');expect(()=>editLeaseId(token)).toThrow();
  });
  it('reuses the same ownership id after an ambiguous network failure',async()=>{
    const fetch=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(ok());vi.stubGlobal('fetch',fetch);
    await expect(acquireEditLease(token)).rejects.toThrow('offline');const id=useEditLease.getState().leaseId;
    await acquireEditLease(token);expect(editLeaseId(token)).toBe(id);
  });
  it('fails closed when renewal fails, preserving the session for a safe reconnect',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(ok()).mockRejectedValue(new Error('offline'));vi.stubGlobal('fetch',fetch);
    await acquireEditLease(token);const stop=maintainEditLease();
    await vi.advanceTimersByTimeAsync(20000);expect(useEditLease.getState().status).toBe('lost');expect(()=>editLeaseId(token)).toThrow();stop();
  });
  it('renews during editing and does not release during React effect cleanup',async()=>{
    const fetch=vi.fn().mockResolvedValue(ok());vi.stubGlobal('fetch',fetch);
    await acquireEditLease(token);const first=useEditLease.getState().deadline;const stop=maintainEditLease();
    await vi.advanceTimersByTimeAsync(20000);expect(useEditLease.getState().deadline).toBeGreaterThan(first);
    stop();expect(useEditLease.getState().status).toBe('active');expect(fetch.mock.calls.map(c=>JSON.parse(c[1].body).action)).toEqual(['acquire','renew']);
  });
  it('releases on page close with keepalive, but not when switching tabs',async()=>{
    const fetch=vi.fn().mockResolvedValue(ok());vi.stubGlobal('fetch',fetch);
    await acquireEditLease(token);const stop=maintainEditLease();
    document.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();
    expect(useEditLease.getState().status).toBe('active');
    window.dispatchEvent(new Event('pagehide'));await vi.advanceTimersByTimeAsync(0);
    expect(useEditLease.getState().status).toBe('released');expect(fetch.mock.calls.at(-1)![1].keepalive).toBe(true);stop();
  });
  it('never releases a newer request when a cancelled request finishes later',async()=>{
    let resolveFirst!:(data:unknown)=>void;
    const fetch=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve;})).mockResolvedValue(ok());vi.stubGlobal('fetch',fetch);
    const first=acquireEditLease(token);const rejected=expect(first).rejects.toThrow('superseded');const oldId=useEditLease.getState().leaseId!;
    await acquireEditLease(token);const currentId=editLeaseId(token);
    resolveFirst(ok());await rejected;
    expect(editLeaseId(token)).toBe(currentId);
    expect(JSON.parse(fetch.mock.calls.at(-1)![1].body)).toEqual({action:'release',leaseId:oldId});
    await releaseOwnedLease(token,oldId);expect(editLeaseId(token)).toBe(currentId);
  });
  it('immediately stops editing when finishing even if release cannot reach the server',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(ok()).mockRejectedValue(new Error('offline')));
    await acquireEditLease(token);await releaseEditLease(token);
    expect(useEditLease.getState().status).toBe('released');expect(useEditLease.getState().message).toContain('3 minutes');expect(()=>editLeaseId(token)).toThrow();
  });
});
