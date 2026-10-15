import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDoc, type Asset } from '../schema/document';
import type { SaveTarget } from './projectFiles';
import { createBackupStore } from './db';

// Verify the backup contract without adding an IndexedDB emulator dependency.
// The parent browser smoke check also exercises the real Dexie transactions.
const fake = vi.hoisted(() => {
  type Row = { id: string; [key: string]: unknown };
  type State = {
    rows: Map<string, Map<string, Row>>;
    queue: Promise<unknown>;
    assetWrites: number;
    assetReads: number;
    failDocWrite: boolean;
  };
  const databases = new Map<string, State>();
  const clone = <T,>(value: T): T => {
    if (!value || typeof value !== 'object') return value;
    // Native FileSystemFileHandle is structured-cloneable. Keep the stand-in
    // handle as a handle, rather than trying to clone its mocked methods.
    if ('getFile' in value && typeof value.getFile === 'function') return value;
    if (Array.isArray(value)) return value.map(clone) as T;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  };
  class Database {
    state: State;
    constructor(name: string) {
      let state = databases.get(name);
      if (!state) {
        state = { rows: new Map(), queue: Promise.resolve(), assetWrites: 0, assetReads: 0, failDocWrite: false };
        databases.set(name, state);
      }
      this.state = state;
    }
    version() {
      return { stores: (schema: Record<string, string>) => {
        for (const name of Object.keys(schema)) {
          if (!this.state.rows.has(name)) this.state.rows.set(name, new Map());
          const rows = this.state.rows.get(name)!;
          const table = {
            get: async (id: string) => clone(rows.get(id)),
            put: async (row: Row) => {
              if (name === 'docs' && this.state.failDocWrite) throw new Error('quota exceeded');
              rows.set(row.id, clone(row));
            },
            bulkGet: async (ids: string[]) => {
              if (name === 'assets') this.state.assetReads += ids.length;
              return ids.map((id) => clone(rows.get(id)));
            },
            bulkPut: async (values: Row[]) => {
              if (name === 'assets') this.state.assetWrites += values.length;
              values.forEach((row) => rows.set(row.id, clone(row)));
            },
            bulkDelete: async (ids: string[]) => { ids.forEach((id) => rows.delete(id)); },
          };
          Object.assign(this, { [name]: table });
        }
      } };
    }
    transaction(...args: unknown[]) {
      const callback = args.at(-1) as () => Promise<unknown>;
      const result = this.state.queue.catch(() => {}).then(async () => {
        const snapshot = new Map(Array.from(this.state.rows, ([name, rows]) => [name, new Map(Array.from(rows, ([id, row]) => [id, clone(row)]))]));
        try { return await callback(); }
        catch (error) {
          for (const [name, rows] of this.state.rows) {
            rows.clear();
            snapshot.get(name)?.forEach((row, id) => rows.set(id, row));
          }
          throw error;
        }
      });
      this.state.queue = result;
      return result;
    }
    close() {}
  }
  return { Database, databases };
});

vi.mock('dexie', () => ({ default: fake.Database }));

const photo = (src = 'data:image/png;base64,large-photo', width = 600): Asset => ({ src, naturalWidth: width, naturalHeight: 400 });
const documentWithPhotos = () => ({ ...emptyDoc(), assets: { hero: photo(), figure: photo('data:image/png;base64,second-photo') } });
const online = (token = 'one', version = 1): SaveTarget => ({ kind: 'online', token, name: `${token}.json`, version });
const state = () => fake.databases.get('backup-test')!;
const docs = () => state().rows.get('docs')!;
const assets = () => state().rows.get('assets')!;

beforeEach(() => { fake.databases.delete('backup-test'); });

describe('normalized browser backup', () => {
  it('round-trips a complete document while the frequently written row excludes photo bytes', async () => {
    const store = createBackupStore('backup-test');
    const doc = documentWithPhotos();
    doc.blocks = [{ id: 'text', type: 'paragraph', text: 'Light travels through the material.' }];
    await store.saveDoc(doc, null, true);

    expect(docs().get('current')?.doc).toEqual({ ...doc, assets: {} });
    expect(JSON.stringify(docs().get('current'))).not.toContain('large-photo');
    expect(assets().size).toBe(2);
    expect(await store.loadDoc()).toEqual(doc);
    expect(await store.loadSession()).toMatchObject({ id: 'current', pending: true, target: null, doc });
  });

  it('writes no unchanged photos or photo reads during repeated ordinary text backups', async () => {
    const store = createBackupStore('backup-test');
    const original = documentWithPhotos();
    await store.saveDoc(original, online(), true);
    for (let index = 0; index < 25; index++) {
      await store.saveDoc({ ...original, meta: { ...original.meta, title: `Edit ${index}` } }, online('one', index + 2), index < 24);
    }
    expect(state().assetWrites).toBe(2);
    expect(state().assetReads).toBe(0);
    expect(await store.loadSession('one')).toMatchObject({ pending: false, target: { version: 26 }, doc: { meta: { title: 'Edit 24' } } });
  });

  it('replaces changed images/metadata, deletes removed images, and restores images on undo', async () => {
    const store = createBackupStore('backup-test');
    const doc = documentWithPhotos();
    await store.saveDoc(doc);
    const resized = { ...doc, assets: { hero: { ...doc.assets.hero, naturalWidth: 800 } } };
    await store.saveDoc(resized);
    expect(state().assetWrites).toBe(3);
    expect(assets().size).toBe(1);
    await store.saveDoc({ ...resized, assets: { hero: photo('data:image/png;base64,replacement') } });
    expect(assets().size).toBe(1);
    await store.saveDoc(doc);
    expect(assets().size).toBe(2);
    expect(await store.loadDoc()).toEqual(doc);
  });

  it('isolates local and online sessions even when they reuse the same article asset IDs', async () => {
    const store = createBackupStore('backup-test');
    const local = { ...emptyDoc(), assets: { shared: photo('local') } };
    const first = { ...emptyDoc(), assets: { shared: photo('first') } };
    const second = { ...emptyDoc(), assets: { shared: photo('second') } };
    await store.saveDoc(local);
    await store.saveDoc(first, online('one'), true);
    await store.saveDoc(second, online('two'), false);
    expect(assets().size).toBe(3);
    expect(await store.loadDoc()).toEqual(local);
    expect((await store.loadSession('one'))?.doc).toEqual(first);
    expect((await store.loadSession('two'))?.doc).toEqual(second);
    await store.saveDoc({ ...first, assets: {} }, online('one'));
    expect(assets().size).toBe(2);
    expect((await store.loadSession('two'))?.doc).toEqual(second);
  });

  it('recovers after a browser restart and avoids rewriting photos after rehydration', async () => {
    const first = createBackupStore('backup-test');
    const doc = documentWithPhotos();
    await first.saveDoc(doc, online(), true);
    first.close();
    const restarted = createBackupStore('backup-test');
    expect((await restarted.loadSession('one'))?.doc).toEqual(doc);
    await restarted.saveDoc({ ...doc, meta: { ...doc.meta, title: 'Restored edit' } }, online(), true);
    expect(state().assetWrites).toBe(2);
  });

  it('reads legacy full-document rows intact and converts only on a successful later backup', async () => {
    const store = createBackupStore('backup-test');
    const doc = documentWithPhotos();
    docs().set('current', { id: 'current', doc, savedAt: 123, pending: true, target: null });
    expect(await store.loadSession()).toEqual({ id: 'current', doc, savedAt: 123, pending: true, target: null });
    expect(assets().size).toBe(0);
    expect(docs().get('current')?.assetRefs).toBeUndefined();
    await store.saveDoc(doc, null, true);
    expect(assets().size).toBe(2);
    expect(await store.loadDoc()).toEqual(doc);
  });

  it('rolls back image changes and removals if writing the document fails', async () => {
    const store = createBackupStore('backup-test');
    const old = documentWithPhotos();
    await store.saveDoc(old, null, true);
    const changed = { ...old, assets: { hero: photo('replacement') } };
    state().failDocWrite = true;
    await expect(store.saveDoc(changed, null, false)).rejects.toThrow('quota exceeded');
    expect(await store.loadDoc()).toEqual(old);
    expect((await store.loadSession())?.pending).toBe(true);
    state().failDocWrite = false;
    await store.saveDoc(changed);
    expect(await store.loadDoc()).toEqual(changed);
    expect(assets().size).toBe(1);
  });

  it('invalidates a stale cache after another tab writes, preserving undo of an image replacement', async () => {
    const first = createBackupStore('backup-test');
    const second = createBackupStore('backup-test');
    const old = { ...emptyDoc(), assets: { hero: photo('old') } };
    await first.saveDoc(old);
    await second.saveDoc({ ...old, assets: { hero: photo('new') } });
    await first.saveDoc(old);
    expect(await second.loadDoc()).toEqual(old);
    expect(state().assetWrites).toBe(3);
  });

  it('snapshots mutable target versions before awaiting a write and keeps native file handles', async () => {
    const store = createBackupStore('backup-test');
    const target = online('one', 7);
    const saving = store.saveDoc(emptyDoc(), target, true);
    if (target.kind === 'online') target.version = 8;
    await saving;
    expect((await store.loadSession('one'))?.target).toMatchObject({ version: 7 });

    const handle = { name: 'article.json', getFile: vi.fn(), createWritable: vi.fn() };
    const fileTarget: SaveTarget = { kind: 'file', handle, modified: 100 };
    const fileSave = store.saveDoc(emptyDoc(), fileTarget, true);
    fileTarget.modified = 200;
    await fileSave;
    expect((await store.loadSession())?.target).toEqual({ kind: 'file', handle, modified: 100 });
  });

  it('reports a missing image as a recovery error instead of returning an incomplete document', async () => {
    const store = createBackupStore('backup-test');
    await store.saveDoc(documentWithPhotos());
    assets().delete(assets().keys().next().value!);
    await expect(store.loadDoc()).rejects.toThrow('could not be recovered');
    expect(docs().size).toBe(1);
  });

  it('preserves assets beyond the bounded cache and does not rewrite them unnecessarily', async () => {
    const store = createBackupStore('backup-test');
    const doc = { ...emptyDoc(), assets: Object.fromEntries(Array.from({ length: 514 }, (_, id) => [`photo-${id}`, photo(`image-${id}`)])) };
    await store.saveDoc(doc);
    await store.saveDoc({ ...doc, meta: { ...doc.meta, title: 'Text only' } });
    expect(state().assetWrites).toBe(514);
    expect(state().assetReads).toBe(2);
    expect((await store.loadDoc())?.assets).toEqual(doc.assets);
  });
});
