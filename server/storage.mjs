import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { issueError, validateIssueDocuments, validateIssuePlan, validateIssueVersion } from './issue.mjs';
import { editLocks } from './editLocks.mjs';
import { heroSource } from './heroPreview.mjs';

export const token = () => randomBytes(32).toString('base64url');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function storedObject(text, code, message, context) {
  try {
    const value = JSON.parse(text);
    if (!object(value)) throw new Error('Expected an object');
    return value;
  } catch {
    // Do not attach a JSON.parse error: its message can contain private copy.
    throw Object.assign(new Error(message), { status: 422, code, ...context });
  }
}
function readFinalization(text, projectId) {
  if (!text) return null;
  let value;
  try { value = JSON.parse(text); } catch { /* Derived metadata can be rebuilt. */ }
  if (value === null) return null;
  const valid = object(value) && Number.isSafeInteger(value.at) && value.at >= 0 &&
    Number.isSafeInteger(value.contentsStartNumber) && value.contentsStartNumber >= 0 &&
    Array.isArray(value.documents) && value.documents.every(entry => object(entry) &&
      typeof entry.id === 'string' && Number.isSafeInteger(entry.version) && entry.version >= 1 &&
      Number.isSafeInteger(entry.pageCount) && entry.pageCount >= 1 &&
      Number.isSafeInteger(entry.startNumber) && entry.startNumber >= 0) &&
    new Set(value.documents.map(entry => entry.id)).size === value.documents.length;
  if (valid) return value;
  // Finalization is a cache, not authored content. Leave the original database
  // record untouched; require a fresh finalization instead of crashing opening.
  console.warn(JSON.stringify({ event: 'issue_finalization_ignored', projectId,
    code: 'ISSUE_FINALIZATION_INCOMPLETE' }));
  return null;
}
export function openStorage(filename, lockOptions) {
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY,projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,token TEXT NOT NULL UNIQUE,body TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL,
      UNIQUE(projectId,name));
    CREATE TABLE IF NOT EXISTS project_issues (projectId TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,finalized TEXT,updated INTEGER NOT NULL);`);
  // Older issue tables may predate finalization. Add only the optional column;
  // never recreate a table or reset an existing arrangement or document.
  const issueColumns = db.prepare('PRAGMA table_info(project_issues)').all();
  if (!issueColumns.some(column => column.name === 'finalized')) db.exec('ALTER TABLE project_issues ADD COLUMN finalized TEXT');
  db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const locks = editLocks(db, lockOptions);
  const sharedRow = secret => {
    const row = db.prepare('SELECT id,name,body,version,projectId FROM documents WHERE token=?').get(secret);
    if (!row) issueError(404, 'Document not found or link revoked.');
    return row;
  };
  const listProjects=db.prepare('SELECT id,name,created FROM projects ORDER BY created DESC');
  const listDocuments=db.prepare('SELECT projectId,id,name,token,version,updated FROM documents ORDER BY name');
  const labels=new Map();
  const readLabel=db.prepare("SELECT CASE WHEN json_valid(body) THEN json_extract(body,'$.meta.categoryLabel') END AS category, CASE WHEN json_valid(body) THEN json_extract(body,'$.templateId') END AS templateId FROM documents WHERE id=?");
  const list=()=>{
    const projects=listProjects.all().map(project=>({...project,items:[]}));
    const byId=new Map(projects.map(project=>[project.id,project]));
    for(const {projectId,...item} of listDocuments.all()){
      let label=labels.get(item.id);
      if(label?.version!==item.version){const row=readLabel.get(item.id);label={version:item.version,category:typeof row?.category==='string'?row.category.slice(0,160):'',templateId:typeof row?.templateId==='string'?row.templateId:''};if(labels.size>512)labels.clear();labels.set(item.id,label);}
      byId.get(projectId)?.items.push({...item,category:label.category,templateId:label.templateId});
    }
    return projects;
  };
  const transaction = (write, run) => {
    db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try { const result = run(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const issueSnapshot = projectId => {
    const read = (issueStage, action) => {
      try { return action(); }
      catch (error) { Object.assign(error, { issueStage, projectId }); throw error; }
    };
    const project = read('project', () => db.prepare('SELECT id,name FROM projects WHERE id=?').get(projectId));
    if (!project) issueError(404, 'Project not found.');
    const saved = read('arrangement', () => db.prepare('SELECT plan,version,finalized FROM project_issues WHERE projectId=?').get(projectId));
    const rows = read('documents', () => db.prepare('SELECT id,name,version,updated,body FROM documents WHERE projectId=? ORDER BY name').all(projectId));
    const items = rows.map(({ body, ...item }) => ({ ...item, doc: storedObject(body, 'ISSUE_DOCUMENT_UNREADABLE',
      `The saved document "${item.name}" could not be read. Restore this file from a known-good copy before compiling. No documents were changed.`,
      { issueStage: 'document-json', projectId, documentId: item.id }) }));
    const plan = saved ? storedObject(saved.plan, 'ISSUE_PLAN_UNREADABLE',
      'The saved issue arrangement could not be read. Restore its saved arrangement from a backup; do not delete the articles. No documents were changed.',
      { issueStage: 'arrangement-json', projectId }) : null;
    const finalized = readFinalization(saved?.finalized, projectId);
    const versions = new Map(finalized?.documents.map(item => [item.id, item.version]));
    return { project, version: saved?.version ?? 0, plan,
      items, finalized, sourcesChanged: finalized !== null &&
        (items.length !== versions.size || items.some(item => versions.get(item.id) !== item.version)) };
  };
  const saveIssueRow = (projectId, version, plan, finalized = null) => {
    db.prepare(`INSERT INTO project_issues (projectId,plan,version,finalized,updated) VALUES (?,?,?,?,?)
      ON CONFLICT(projectId) DO UPDATE SET plan=excluded.plan,version=excluded.version,finalized=excluded.finalized,updated=excluded.updated`)
      .run(projectId, JSON.stringify(plan), version, finalized ? JSON.stringify(finalized) : null, Date.now());
  };
  const checkedIssue = (projectId, version, plan) => {
    validateIssueVersion(version);
    const snapshot = issueSnapshot(projectId);
    if (snapshot.version !== version) issueError(409, 'This issue arrangement changed in another session. Refresh before saving; nothing was overwritten.');
    return { snapshot, plan: validateIssuePlan(plan, snapshot.items) };
  };
  return {close:()=>db.close(),list,
    adminPasswordHash(){return db.prepare("SELECT value FROM app_settings WHERE key='admin-password-hash'").get()?.value;},
    changeAdminPasswordHash(expected,replacement){
      return transaction(true,()=>{
        const current=db.prepare("SELECT value FROM app_settings WHERE key='admin-password-hash'").get()?.value;
        if(current!==expected)return false;
        db.prepare("INSERT INTO app_settings(key,value) VALUES('admin-password-hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(replacement);
        return true;
      });
    },
    readIssue(projectId) { return transaction(false, () => issueSnapshot(projectId)); },
    saveIssue(projectId, version, plan) {
      return transaction(true, () => {
        const checked = checkedIssue(projectId, version, plan);
        saveIssueRow(projectId, version + 1, checked.plan);
        return { version: version + 1 };
      });
    },
    finalizeIssue(projectId, version, plan, documents) {
      return transaction(true, () => {
        const checked = checkedIssue(projectId, version, plan);
        const numbering = validateIssueDocuments(documents, checked.plan, checked.snapshot.items);
        for (const entry of numbering.documents) locks.available(entry.id);
        const sources = new Map(checked.snapshot.items.map(item => [item.id, item]));
        for (const { doc } of sources.values()) {
          for (const key of ['footer', 'frontMatter', 'design']) {
            if (doc[key] !== undefined && (doc[key] === null || typeof doc[key] !== 'object' || Array.isArray(doc[key]))) {
              issueError(400, 'A project file has invalid page settings. Open and save that file before finalizing the issue.');
            }
          }
        }
        const update = db.prepare('UPDATE documents SET body=?,version=version+1,updated=? WHERE id=? AND projectId=? AND version=?');
        const at = Date.now();
        const finalizedDocuments = [];
        for (const entry of numbering.documents) {
          const source = sources.get(entry.id);
          const doc = source.doc;
          // Start with the stored JSON, not any client-supplied document content.
          doc.footer = { ...doc.footer, startNumber: entry.startNumber };
          if (entry.mastheadSide) doc.design = { ...doc.design, barSide: entry.mastheadSide };
          if (doc.frontMatter && typeof doc.frontMatter === 'object' && !Array.isArray(doc.frontMatter)) {
            doc.frontMatter.pageStart = entry.startNumber;
          }
          if (update.run(JSON.stringify(doc), at, entry.id, projectId, entry.version).changes !== 1) {
            issueError(409, 'A project file changed. No page numbers were changed.');
          }
          finalizedDocuments.push({ id: entry.id, version: entry.version + 1, pageCount: entry.pageCount, startNumber: entry.startNumber });
        }
        saveIssueRow(projectId, version + 1, checked.plan, { at, contentsStartNumber: numbering.contentsStartNumber, documents: finalizedDocuments });
        return { version: version + 1, items: finalizedDocuments.map(({ id, version: documentVersion }) => ({ id, version: documentVersion })) };
      });
    },
    createProject(name){const id=randomUUID();db.prepare('INSERT INTO projects VALUES (?,?,?)').run(id,name,Date.now());return{id,name};},
    renameProject(id,name,previousName){
      return transaction(true,()=>{
        const current=db.prepare('SELECT name FROM projects WHERE id=?').get(id);
        if(!current)issueError(404,'Project not found.');
        if(current.name!==previousName)issueError(409,'This project was renamed in another session. Refresh the library and try again.');
        db.prepare('UPDATE projects SET name=? WHERE id=?').run(name,id);
        return{id,name};
      });
    },
    createDocument(projectId,name,body){const id=randomUUID(),secret=token();db.prepare('INSERT INTO documents VALUES (?,?,?,?,?,1,?)').run(id,projectId,name,secret,body,Date.now());return{id,name,token:secret,version:1};},
    read(secret){return db.prepare('SELECT id,name,body,version FROM documents WHERE token=?').get(secret);},
    sharedProjectName(secret){return db.prepare('SELECT p.name FROM documents d JOIN projects p ON p.id=d.projectId WHERE d.token=?').get(secret)?.name;},
    readHero(id) {
      const row = db.prepare('SELECT body FROM documents WHERE id=?').get(id);
      return row ? heroSource(row.body) : undefined;
    },
    heroVersion(id) { return db.prepare('SELECT version FROM documents WHERE id=?').get(id)?.version; },
    readHeroRecord(id) {
      const row=db.prepare('SELECT body,version FROM documents WHERE id=?').get(id);
      return row?{version:row.version,source:heroSource(row.body)}:undefined;
    },
    lockStatus(secret) { return locks.status(sharedRow(secret).id); },
    editLease(secret, action, leaseId) {
      return transaction(true, () => {
        const row = sharedRow(secret);
        if (action === 'release') return locks.release(row.id, leaseId);
        if (action === 'renew') return locks.renew(row.id, leaseId);
        if (action !== 'acquire') issueError(400, 'Unknown editing session action.');
        const lease = locks.acquire(row.id, leaseId);
        return { ...lease, name:row.name, version:row.version, doc:JSON.parse(row.body), projectName:db.prepare('SELECT name FROM projects WHERE id=?').get(row.projectId)?.name };
      });
    },
    update(secret,version,body,leaseId){return transaction(true,()=>{
      const row=sharedRow(secret);locks.assert(row.id,leaseId);
      const changed=db.prepare('UPDATE documents SET body=?,version=version+1,updated=? WHERE token=? AND version=?').run(body,Date.now(),secret,version).changes>0;
      if(changed)locks.renew(row.id,leaseId);
      return changed;
    });},
    removeProject(id,confirmation){return transaction(true,()=>{
      for(const row of db.prepare('SELECT id FROM documents WHERE projectId=?').all(id))locks.available(row.id);
      return db.prepare('DELETE FROM projects WHERE id=? AND name=?').run(id,confirmation).changes>0;
    });},
    removeDocument(id,confirmation){return transaction(true,()=>{locks.available(id);return db.prepare('DELETE FROM documents WHERE id=? AND name=?').run(id,confirmation).changes>0;});},
  };
}
