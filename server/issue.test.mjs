import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStorage } from './storage.mjs';

const original = {
  schemaVersion: 1, templateId: 'paper-3', meta: { title: 'مقال Physics', subtitle: 'Keep whitespace  ' },
  blocks: [{ id: 'p1', type: 'paragraph', text: 'Untouched author copy.' }],
  design: { custom: { colors: ['#ffcc00'] } }, assets: { logo: { data: 'data:image/png;base64,aGVsbG8=' } },
  highlights: [{ text: 'Keep this highlight', spacing: 12 }],
  footer: { enabled: true, text: 'Journal', startNumber: 41, fontSize: 8, bottomOffset: 15 },
  frontMatter: { pageStart: 41, logoAfterParagraph: 2, about: 'Original content', unknown: ['Preserve'] },
  futureField: { keep: true },
};
const makePlan = order => ({ order, startNumber: 1, countCovers: false, contentsTitle: 'Contents',
  contentsSubtitle: 'This issue', direction: 'ltr', contentsExcluded: [] });
const status = code => error => error.status === code;
function memory(t) {
  const storage = openStorage(':memory:');
  t.after(() => storage.close());
  const project = storage.createProject('Journal');
  const add = (name, doc = original) => storage.createDocument(project.id, name, JSON.stringify(doc));
  return { storage, project, add };
}

test('finalize changes only numbering and preserves every stored content field', t => {
  const { storage, project, add } = memory(t);
  const a = add('Article.json');
  const result = storage.finalizeIssue(project.id, 0, makePlan(['__contents__', a.id]),
    [{ id: a.id, version: 1, pageCount: 4, startNumber: 3, doc: { meta: { title: 'Malicious replacement' } } }]);
  assert.equal(result.version, 1);
  const saved = JSON.parse(storage.read(a.token).body);
  assert.deepEqual(saved, { ...original, footer: { ...original.footer, startNumber: 3 },
    design: { ...original.design, barSide: 'left' },
    frontMatter: { ...original.frontMatter, pageStart: 3 } });
  assert.deepEqual(storage.readIssue(project.id).finalized.documents,
    [{ id: a.id, version: 2, pageCount: 4, startNumber: 3 }]);
});

test('covers can be omitted from numbering while contents always occupies two pages', t => {
  const { storage, project, add } = memory(t);
  const cover = add('Cover.json', { ...original, templateId: 'magazine-4' });
  const article = add('Article.json');
  const back = add('Back.json', { ...original, templateId: 'backcover-1' });
  const plan = makePlan([cover.id, '__contents__', article.id, back.id]);
  const documents = [{ id: cover.id, version: 1, pageCount: 1, startNumber: 1 },
    { id: article.id, version: 1, pageCount: 4, startNumber: 3 },
    { id: back.id, version: 1, pageCount: 1, startNumber: 7 }];
  storage.finalizeIssue(project.id, 0, plan, documents);
  assert.equal(storage.readIssue(project.id).finalized.contentsStartNumber, 1);
  storage.finalizeIssue(project.id, 1, { ...plan, countCovers: true }, documents.map((entry, i) =>
    ({ ...entry, version: 2, startNumber: i === 0 ? 1 : entry.startNumber + 1 })));
  assert.equal(storage.readIssue(project.id).finalized.contentsStartNumber, 2);
  assert.equal(JSON.parse(storage.read(article.token).body).design.barSide, 'left');
  assert.deepEqual(JSON.parse(storage.read(cover.token).body).design, original.design);
});

test('contents colours and card crops survive saving and reopening', t => {
  const { storage, project, add } = memory(t);
  const article = add('Article.json');
  const plan = { ...makePlan(['__contents__', article.id]),
    contentsDesign: { pageColor: '#182022', textColor: '#ffffff', topBarColor: '#800080', layout: 'mosaic', density: 'auto' },
    contentsStyle: { [article.id]: { title: 'Edited heading', hero: false, assetId: null, frame: { scale: 1.5, offsetX: -10, offsetY: 20 } } } };
  storage.saveIssue(project.id, 0, plan);
  assert.deepEqual(storage.readIssue(project.id).plan, plan);
  assert.throws(() => storage.saveIssue(project.id, 1, { ...plan, contentsDesign: { pageColor: 'url(evil)' } }), status(400));
  assert.deepEqual(storage.readIssue(project.id).plan, plan);
});

test('finalization derives alternating sides from interior pages, ignoring client sides', t => {
  const { storage, project, add } = memory(t);
  const cover = add('Cover.json', { ...original, templateId: 'magazine-4' });
  const a = add('A.json'), b = add('B.json');
  const plan = { ...makePlan([cover.id, a.id, '__contents__', b.id]), startNumber: 2, countCovers: true };
  storage.finalizeIssue(project.id, 0, plan, [
    { id: cover.id, version: 1, pageCount: 1, startNumber: 2, mastheadSide: 'right' },
    { id: a.id, version: 1, pageCount: 3, startNumber: 3, mastheadSide: 'right' },
    { id: b.id, version: 1, pageCount: 1, startNumber: 8, mastheadSide: 'left' },
  ]);
  assert.deepEqual(JSON.parse(storage.read(cover.token).body).design, original.design);
  assert.equal(JSON.parse(storage.read(a.token).body).design.barSide, 'left');
  assert.equal(JSON.parse(storage.read(b.token).body).design.barSide, 'right');
});

test('invalid numbering, incomplete page counts and changed membership leave all files untouched', t => {
  const { storage, project, add } = memory(t);
  const a = add('Article.json');
  const plan = makePlan(['__contents__', a.id]);
  const valid = { id: a.id, version: 1, pageCount: 2, startNumber: 3 };
  const before = storage.read(a.token);
  for (const documents of [[], [valid, valid], [{ ...valid, id: 'missing' }], [{ ...valid, pageCount: 0 }],
    [{ ...valid, pageCount: 1.5 }], [{ ...valid, pageCount: Number.MAX_SAFE_INTEGER + 1 }],
    [{ ...valid, startNumber: 4 }], [{ ...valid, pageCount: 100000 }]]) {
    assert.throws(() => storage.finalizeIssue(project.id, 0, plan, documents), status(400));
    assert.deepEqual(storage.read(a.token), before);
    assert.equal(storage.readIssue(project.id).version, 0);
  }
  add('Added while arranging.json');
  assert.throws(() => storage.finalizeIssue(project.id, 0, plan, [valid]), status(400));
  assert.deepEqual(storage.read(a.token), before);
});

test('issue migration preserves an existing database and failures roll back prior document updates', t => {
  const dir = mkdtempSync(join(tmpdir(), 'magazoo-issue-test-'));
  const filename = join(dir, 'existing.sqlite');
  const legacy = new DatabaseSync(filename);
  legacy.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE projects (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,created INTEGER NOT NULL);
    CREATE TABLE documents (id TEXT PRIMARY KEY,projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,token TEXT NOT NULL UNIQUE,body TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL,
      UNIQUE(projectId,name));`);
  legacy.prepare('INSERT INTO projects VALUES (?,?,?)').run('legacy', 'Existing publication', 123);
  for (const id of ['first', 'second']) {
    legacy.prepare('INSERT INTO documents VALUES (?,?,?,?,?,?,?)').run(id, 'legacy', `${id}.json`, `${id}-secret`, JSON.stringify(original), 7, 456);
  }
  legacy.close();
  const storage = openStorage(filename);
  const observer = new DatabaseSync(filename);
  t.after(() => { observer.close(); storage.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.equal(storage.read('first-secret').version, 7);
  assert.deepEqual(JSON.parse(storage.read('first-secret').body), original);
  const plan = makePlan(['first', 'second', '__contents__']);
  storage.saveIssue('legacy', 0, plan);
  observer.exec("CREATE TRIGGER simulate_failure BEFORE UPDATE ON documents WHEN OLD.id='second' BEGIN SELECT RAISE(ABORT,'simulated write failure'); END;");
  const before = storage.read('first-secret');
  const documents = [{ id: 'first', version: 7, pageCount: 2, startNumber: 1 }, { id: 'second', version: 7, pageCount: 2, startNumber: 3 }];
  assert.throws(() => storage.finalizeIssue('legacy', 1, plan, documents), /simulated write failure/);
  assert.deepEqual(storage.read('first-secret'), before, 'earlier update rolled back when a later write failed');
  assert.equal(storage.readIssue('legacy').version, 1);
  assert.equal(storage.readIssue('legacy').finalized, null);
  observer.exec('DROP TRIGGER simulate_failure');
  storage.finalizeIssue('legacy', 1, plan, documents);
  assert.equal(storage.readIssue('legacy').version, 2);
  assert.equal(storage.removeProject('legacy', 'Existing publication'), true);
  assert.equal(observer.prepare('SELECT COUNT(*) AS n FROM project_issues').get().n, 0);
});
