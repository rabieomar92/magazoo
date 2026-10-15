import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDoc, type Doc } from '../schema/document';
import { useDoc } from './useDoc';
import { bindTarget, useProjectFile, type SaveTarget } from './projectFiles';
import { useEditLease } from './editLease';
import { useSaveStatus } from './saveStatus';
import { startAutosave } from './persist';

const storage = vi.hoisted(() => ({
  saveDoc: vi.fn(), loadDoc: vi.fn(), loadSession: vi.fn(),
}));
vi.mock('./db', () => storage);
vi.mock('../lib/serializeDocument', () => ({
  serializeDocument: vi.fn(async (doc: Doc) => JSON.stringify(doc)),
}));

const token = 'a'.repeat(43);
const delay = 100;
let stop: (() => void) | undefined;
let stored: { doc: Doc; target: SaveTarget | null; pending: boolean }[];
let releaseDeferred: (() => void)[];

function deferred<T = void>(cleanupValue?: T) {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  releaseDeferred.push(() => resolve(cleanupValue as T));
  return { promise, resolve };
}
async function settle() {
  // Let the debounced flush, local backup, serialization and response finish.
  // No real clock or database is needed for these persistence decisions.
  for (let i = 0; i < 30; i++) await Promise.resolve();
}
function edit(title: string) {
  useDoc.getState().update(doc => { doc.meta.title = title; });
  return useDoc.getState().doc;
}
function bindOnline(doc: Doc | null = useDoc.getState().doc, onlineToken = token) {
  bindTarget({ kind: 'online', token: onlineToken, version: 1, name: 'Article.json' }, doc);
}
function hide() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  releaseDeferred = [];
  stored = [];
  storage.saveDoc.mockImplementation(async (doc: Doc, target: SaveTarget | null, pending: boolean) => {
    stored.push({ doc, target: target ? { ...target } : null, pending });
  });
  storage.loadDoc.mockResolvedValue(null);
  storage.loadSession.mockResolvedValue(null);
  useDoc.getState().load(emptyDoc());
  useDoc.temporal.getState().clear();
  bindTarget(null, null);
  useSaveStatus.setState({ status: 'idle' });
  useEditLease.setState({ status: 'active', token, leaseId: 'autosave-test-lease', deadline: Date.now() + 180000 });
  let version = 1;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ version: ++version }) })));
});

afterEach(async () => {
  stop?.();
  stop = undefined;
  releaseDeferred.forEach(release => release());
  await settle();
  bindTarget(null, null);
  useDoc.getState().load(emptyDoc());
  useDoc.temporal.getState().clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('autosave write scheduling', () => {
  it('backs up one latest unbound draft after a typing burst', async () => {
    stop = startAutosave(delay);
    edit('F'); edit('Fi'); const latest = edit('Final draft');
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(storage.saveDoc).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(stored).toEqual([{ doc: latest, target: null, pending: true }]);
    expect(fetch).not.toHaveBeenCalled();
    expect(useSaveStatus.getState().status).toBe('saved');
  });

  it('makes one online write and only the necessary pending and confirmed backups', async () => {
    bindOnline();
    stop = startAutosave(delay);
    edit('A'); edit('An'); const latest = edit('An article');
    await vi.advanceTimersByTimeAsync(delay);
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(stored).toEqual([
      { doc: latest, target: expect.objectContaining({ version: 1, token }), pending: true },
      { doc: latest, target: expect.objectContaining({ version: 2, token }), pending: false },
    ]);
    expect(useProjectFile.getState().savedDoc).toBe(latest);
    hide(); hide();
    await settle();
    expect(storage.saveDoc).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not emit duplicate pending notifications for each keystroke', async () => {
    bindOnline();
    const projectStatuses: string[] = [];
    const backupStatuses: string[] = [];
    const unsubscribeProject = useProjectFile.subscribe(state => projectStatuses.push(state.status));
    const unsubscribeBackup = useSaveStatus.subscribe(state => backupStatuses.push(state.status));
    stop = startAutosave(delay);
    edit('One'); edit('Two'); edit('Three');
    expect(projectStatuses).toEqual(['pending']);
    expect(backupStatuses).toEqual(['saving']);
    unsubscribeProject(); unsubscribeBackup();
    await vi.advanceTimersByTimeAsync(delay);
    await settle();
  });

  it('keeps visibility flushes single flight while storage and network are busy', async () => {
    bindOnline();
    const backup = deferred();
    const response = deferred({ ok: true, status: 200, json: async () => ({ version: 2 }) });
    storage.saveDoc.mockImplementationOnce(async (doc: Doc, target: SaveTarget | null, pending: boolean) => {
      stored.push({ doc, target: target ? { ...target } : null, pending });
      await backup.promise;
    });
    vi.mocked(fetch).mockReturnValueOnce(response.promise as Promise<Response>);
    stop = startAutosave(delay);
    edit('Latest');
    hide(); hide(); hide();
    await settle();
    expect(storage.saveDoc).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    backup.resolve();
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    hide(); hide();
    await settle();
    expect(storage.saveDoc).toHaveBeenCalledTimes(1);
    response.resolve({ ok: true, status: 200, json: async () => ({ version: 2 }) });
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(storage.saveDoc).toHaveBeenCalledTimes(2);
    expect(stored.map(item => item.pending)).toEqual([true, false]);
  });

  it('coalesces edits during a slow backup into the latest recovery snapshot', async () => {
    const backup = deferred();
    storage.saveDoc.mockImplementationOnce(async (doc: Doc, target: SaveTarget | null, pending: boolean) => {
      stored.push({ doc, target: target ? { ...target } : null, pending });
      await backup.promise;
    });
    stop = startAutosave(delay);
    const first = edit('First'); hide();
    await settle();
    edit('Intermediate one'); hide();
    edit('Intermediate two'); hide();
    const latest = edit('Newest'); hide();
    await settle();
    expect(storage.saveDoc).toHaveBeenCalledTimes(1);
    backup.resolve();
    await settle();
    expect(stored.map(item => item.doc)).toEqual([first, latest]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps an unsaved online recovery copy on cleanup without a late network save', async () => {
    bindOnline();
    stop = startAutosave(delay);
    const latest = edit('Keep this recovery draft');
    stop(); stop = undefined;
    await settle();
    await vi.advanceTimersByTimeAsync(delay * 4);
    hide();
    await settle();
    expect(stored).toEqual([
      { doc: latest, target: expect.objectContaining({ token }), pending: true },
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('backs up the newly loaded document with its own target after a synchronous route switch', async () => {
    bindOnline();
    stop = startAutosave(delay);
    edit('Old article unsaved');
    const next = emptyDoc(); next.meta.title = 'New article';
    const nextToken = 'b'.repeat(43);
    bindOnline(next, nextToken);
    useDoc.getState().load(next);
    await settle();
    await vi.advanceTimersByTimeAsync(delay);
    await settle();
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every(item => item.target?.kind !== 'online' || item.target.token !== nextToken || item.doc === next)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(useProjectFile.getState().savedDoc).toBe(next);
  });

  it('corrects the server after undo returns to an older saved snapshot during a write', async () => {
    const original = useDoc.getState().doc;
    bindOnline(original);
    const response = deferred({ ok: true, status: 200, json: async () => ({ version: 2 }) });
    vi.mocked(fetch).mockReturnValueOnce(response.promise as Promise<Response>).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ version: 3 }),
    } as Response);
    stop = startAutosave(delay);
    edit('Edited article'); hide();
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    useDoc.temporal.getState().undo();
    expect(useDoc.getState().doc).toBe(original);
    hide();
    response.resolve({ ok: true, status: 200, json: async () => ({ version: 2 }) });
    await settle();
    await vi.advanceTimersByTimeAsync(delay);
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    const request = vi.mocked(fetch).mock.calls[1][1];
    expect(JSON.parse(String(request?.body))).toEqual(original);
    expect(useProjectFile.getState().savedDoc).toBe(original);
    expect(stored.at(-1)).toEqual({ doc: original, target: expect.objectContaining({ version: 3 }), pending: false });
  });
});
