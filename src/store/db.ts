import Dexie, { type Table } from 'dexie';
import type { Asset, Doc } from '../schema/document';
import type { SaveTarget } from './projectFiles';

export interface DocRow {
  id: string;
  doc: Doc;
  savedAt: number;
  target?: SaveTarget | null;
  pending?: boolean;
}

/** Version 1 rows contain a complete Doc. Version 2 moves only its asset
 * dictionary out of the frequently overwritten row; saved JSON stays unchanged. */
interface StoredDocRow extends DocRow {
  assetRefs?: Record<string, string>;
  revision?: string;
}
interface AssetRow { id: string; sessionId: string; asset: Asset }

class RhbDb extends Dexie {
  docs!: Table<StoredDocRow, string>;
  assets!: Table<AssetRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ docs: 'id' });
    // Keep old full-document rows intact. Convert each only after the next
    // successful backup, within the same transaction as all its image writes.
    this.version(2).stores({ docs: 'id', assets: 'id, sessionId' });
  }
}

const sessionId = (token?: string) => token ? `online:${token}` : 'current';
const assetKey = (session: string, assetId: string) => JSON.stringify([session, assetId]);
const sameAsset = (left: Asset | undefined, right: Asset) => {
  if (!left) return false;
  const keys = Object.keys(left) as (keyof Asset)[];
  return keys.length === Object.keys(right).length && keys.every((key) => Object.is(left[key], right[key]));
};

export interface BackupStore {
  loadDoc(): Promise<Doc | null>;
  loadSession(token?: string): Promise<DocRow | undefined>;
  saveDoc(doc: Doc, target?: SaveTarget | null, pending?: boolean): Promise<void>;
  close(): void;
}

/** An injectable database name lets browser checks use a disposable database
 * without touching the editor's real recovery drafts. */
export function createBackupStore(name = 'rhb'): BackupStore {
  const db = new RhbDb(name);
  // Only one session is retained, with a fixed entry limit. Values contain
  // references to immutable source strings, never a second encoded image.
  const cacheLimit = 512;
  let cache: { session: string; revision: string; assets: Map<string, Asset> } | undefined;
  const remember = (session: string, revision: string, assets: Record<string, Asset>) => {
    cache = { session, revision, assets: new Map(Object.entries(assets).slice(0, cacheLimit).map(([id, asset]) => [id, { ...asset }])) };
  };

  const loadSession = async (token?: string): Promise<DocRow | undefined> => {
    const id = sessionId(token);
    return db.transaction('r', db.docs, db.assets, async () => {
      const row = await db.docs.get(id);
      if (!row) return undefined;
      if (!row.assetRefs) return row;
      const refs = Object.entries(row.assetRefs);
      const stored = await db.assets.bulkGet(refs.map(([, key]) => key));
      const assets = Object.fromEntries(refs.map(([assetId], index) => {
        const value = stored[index];
        // A damaged backup must never be mistaken for an empty/imageless one.
        if (!value || value.sessionId !== id) throw new Error('A saved draft image could not be recovered. The draft has not been changed.');
        return [assetId, value.asset];
      }));
      if (row.revision) remember(id, row.revision, assets);
      return { id: row.id, doc: { ...row.doc, assets }, savedAt: row.savedAt, target: row.target, pending: row.pending };
    });
  };

  const saveDoc = async (doc: Doc, target: SaveTarget | null = null, pending = false): Promise<void> => {
    // Target version/timestamp changes after a remote/file save. Snapshot the
    // outer object before any await, preserving the native file handle itself.
    const storedTarget = target ? { ...target } : null;
    const id = sessionId(storedTarget?.kind === 'online' ? storedTarget.token : undefined);
    const revision = crypto.randomUUID();
    const assets = doc.assets;
    await db.transaction('rw', db.docs, db.assets, async () => {
      const previous = await db.docs.get(id);
      const oldRefs = previous?.assetRefs ?? {};
      const known = cache?.session === id && cache.revision === previous?.revision ? cache.assets : new Map<string, Asset>();
      // After a restart, another tab's write, or for entries beyond the bounded
      // cache, read persisted images once to avoid needlessly rewriting them.
      const unknown = Object.entries(oldRefs).filter(([assetId]) => !known.has(assetId));
      if (unknown.length) {
        const stored = await db.assets.bulkGet(unknown.map(([, key]) => key));
        unknown.forEach(([assetId], index) => {
          if (stored[index]?.sessionId === id) known.set(assetId, stored[index]!.asset);
        });
      }
      const refs = Object.fromEntries(Object.keys(assets).map((assetId) => [assetId, assetKey(id, assetId)]));
      const changed = Object.entries(assets).filter(([assetId, asset]) => oldRefs[assetId] !== refs[assetId] || !sameAsset(known.get(assetId), asset));
      if (changed.length) await db.assets.bulkPut(changed.map(([assetId, asset]) => ({ id: refs[assetId], sessionId: id, asset: { ...asset } })));
      const retained = new Set(Object.values(refs));
      const removed = Object.values(oldRefs).filter((key) => !retained.has(key));
      if (removed.length) await db.assets.bulkDelete(removed);
      await db.docs.put({ id, doc: { ...doc, assets: {} }, assetRefs: refs, revision, target: storedTarget, pending, savedAt: Date.now() });
    });
    remember(id, revision, assets);
  };

  return {
    loadDoc: async () => (await loadSession())?.doc ?? null,
    loadSession,
    saveDoc,
    close: () => { cache = undefined; db.close(); },
  };
}

const backup = createBackupStore();
export const loadDoc = backup.loadDoc;
export const loadSession = backup.loadSession;
export const saveDoc = backup.saveDoc;
