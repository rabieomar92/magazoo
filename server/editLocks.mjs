export const EDIT_LEASE_MS = 180_000;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function editLocks(db, { now = Date.now, leaseMs = EDIT_LEASE_MS } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS document_edit_locks (
    documentId TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    leaseId TEXT NOT NULL, expires INTEGER NOT NULL);`);
  const find = id => db.prepare('SELECT leaseId,expires FROM document_edit_locks WHERE documentId=?').get(id);
  const valid = id => typeof id === 'string' && /^[\w-]{32,64}$/.test(id);
  const assert = (documentId, leaseId) => {
    const lock = find(documentId);
    if (!valid(leaseId) || !lock || lock.leaseId !== leaseId || lock.expires <= now()) {
      fail(423, 'Editing access is not held by this tab. Your changes were not written. Reopen editing access before saving.');
    }
  };
  const available = documentId => {
    const lock = find(documentId);
    if (lock && lock.expires > now()) fail(423, 'A document is currently being edited. Ask the editor to save and finish editing before changing or finalising it.');
  };
  return {
    assert, available,
    status(documentId) { const lock = find(documentId); return { locked: !!lock && lock.expires > now() }; },
    acquire(documentId, leaseId) {
      if (!valid(leaseId)) fail(400, 'A valid editing session is required.');
      const lock = find(documentId);
      if (lock && lock.expires > now() && lock.leaseId !== leaseId) fail(423, 'Someone is already editing this document. It is read-only until they finish or close the page.');
      db.prepare(`INSERT INTO document_edit_locks(documentId,leaseId,expires) VALUES (?,?,?)
        ON CONFLICT(documentId) DO UPDATE SET leaseId=excluded.leaseId,expires=excluded.expires`).run(documentId, leaseId, now() + leaseMs);
      return { validForMs: leaseMs };
    },
    renew(documentId, leaseId) {
      assert(documentId, leaseId);
      db.prepare('UPDATE document_edit_locks SET expires=? WHERE documentId=? AND leaseId=?').run(now() + leaseMs, documentId, leaseId);
      return { validForMs: leaseMs };
    },
    release(documentId, leaseId) {
      if (!valid(leaseId)) fail(400, 'A valid editing session is required.');
      db.prepare('DELETE FROM document_edit_locks WHERE documentId=? AND leaseId=?').run(documentId, leaseId);
      return { released: true };
    },
  };
}
