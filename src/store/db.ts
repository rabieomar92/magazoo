import Dexie, { type Table } from 'dexie';
import type { Doc } from '../schema/document';
import type { SaveTarget } from './projectFiles';

/**
 * One document, one row. This app edits a single highlight at a time — the
 * store holds one Doc, Save/Open swaps it — so persistence is just a single
 * key-value row we overwrite. IndexedDB (not localStorage) because assets are
 * embedded as data URLs and can be megabytes.
 */
interface DocRow {
  id: string;
  doc: Doc;
  savedAt: number;
  target?: SaveTarget | null;
  pending?: boolean;
}

class RhbDb extends Dexie {
  docs!: Table<DocRow, string>;

  constructor() {
    super('rhb');
    this.version(1).stores({ docs: 'id' });
  }
}

const db = new RhbDb();

/** The persisted document, or null on a clean first run. */
export async function loadDoc(): Promise<Doc | null> {
  const row = await db.docs.get('current');
  return row ? row.doc : null;
}

/** Overwrite the single stored document. */
export async function saveDoc(doc: Doc, target:SaveTarget|null=null, pending=false): Promise<void> {
  await db.docs.put({ id:target?.kind==='online' ? `online:${target.token}`:'current', doc, target, pending, savedAt: Date.now() });
}
export const loadSession = (token?:string) => db.docs.get(token ? `online:${token}`:'current');
