import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';

export const token = () => randomBytes(32).toString('base64url');
export function openStorage(filename) {
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY,projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,token TEXT NOT NULL UNIQUE,body TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL,
      UNIQUE(projectId,name));`);
  const list=()=>db.prepare('SELECT id,name,created FROM projects ORDER BY created DESC').all().map(project=>({...project,
    items:db.prepare('SELECT id,name,token,version,updated FROM documents WHERE projectId=? ORDER BY name').all(project.id)}));
  return {close:()=>db.close(),list,
    createProject(name){const id=randomUUID();db.prepare('INSERT INTO projects VALUES (?,?,?)').run(id,name,Date.now());return{id,name};},
    createDocument(projectId,name,body){const id=randomUUID(),secret=token();db.prepare('INSERT INTO documents VALUES (?,?,?,?,?,1,?)').run(id,projectId,name,secret,body,Date.now());return{id,name,token:secret,version:1};},
    read(secret){return db.prepare('SELECT id,name,body,version FROM documents WHERE token=?').get(secret);},
    update(secret,version,body){return db.prepare('UPDATE documents SET body=?,version=version+1,updated=? WHERE token=? AND version=?').run(body,Date.now(),secret,version).changes>0;},
    removeProject(id,confirmation){return db.prepare('DELETE FROM projects WHERE id=? AND name=?').run(id,confirmation).changes>0;},
    removeDocument(id,confirmation){return db.prepare('DELETE FROM documents WHERE id=? AND name=?').run(id,confirmation).changes>0;},
  };
}
