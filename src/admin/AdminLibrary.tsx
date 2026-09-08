import { useState } from 'react';

interface Item { id: string; name: string; token: string; version: number; updated: number }
interface Project { id: string; name: string; items: Item[] }
export interface DeleteTarget { name: string; path: string; project: boolean }

export default function AdminLibrary({ projects, busy, onDelete, onCopy, link }: {
  projects: Project[]; busy: boolean; onDelete: (target: DeleteTarget) => void;
  onCopy: (item: Item) => void; link: (token: string) => string;
}) {
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const filter = projects.some(p => p.id === projectId) ? projectId : '';
  const search = query.trim().toLocaleLowerCase();
  // Empty projects occupy one result so they remain manageable, even in large libraries.
  const rows = projects.filter(p => !filter || p.id === filter).flatMap(project => {
    const matchesProject = project.name.toLocaleLowerCase().includes(search);
    if (!project.items.length) return matchesProject ? [{ project, item: null as Item | null }] : [];
    return project.items.filter(item => matchesProject || item.name.toLocaleLowerCase().includes(search))
      .map(item => ({ project, item: item as Item | null }));
  });
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * size, current * size);
  const groups = new Map<string, { project: Project; items: Item[] }>();
  for (const { project, item } of visible) {
    if (!groups.has(project.id)) groups.set(project.id, { project, items: [] });
    if (item) groups.get(project.id)!.items.push(item);
  }
  return <>
    <div className="admin-library-controls">
      <label>Search JSON files<input type="search" value={query} placeholder="File or project name" onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
      <label>Project<select value={filter} onChange={e => { setProjectId(e.target.value); setPage(1); }}><option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Per page<select value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }}>{[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    </div>
    <p className="admin-result-count" role="status">{rows.length ? `${(current - 1) * size + 1}–${Math.min(current * size, rows.length)} of ${rows.length} results` : 'No results'} · Empty projects count as one result.</p>
    {!rows.length && <section className="admin-card admin-empty"><h3>{projects.length ? 'No matching documents.' : 'Your library is ready.'}</h3><p>{projects.length ? 'Try another file name or project.' : 'Create a project, then add its JSON documents.'}</p>{projects.length > 0 && <button onClick={() => { setQuery(''); setProjectId(''); setPage(1); }}>Clear filters</button>}</section>}
    {[...groups.values()].map(({ project: p, items }) => <section className="admin-card admin-project" key={p.id}>
      <header><div><h3>{p.name}</h3><span>{p.items.length} documents in project</span></div><button disabled={busy} className="danger-quiet" onClick={() => onDelete({ name: p.name, path: `projects/${p.id}`, project: true })}>Delete project</button></header>
      <ul>{items.map(item => <li key={item.id}><div className="admin-item-name"><strong>{item.name}</strong><small>Version {item.version} · {new Date(item.updated).toLocaleString()}</small></div><div className="admin-actions"><a href={link(item.token)} target="_blank" rel="noreferrer">Edit ↗</a><button disabled={busy} onClick={() => onCopy(item)}>Copy private link</button><button disabled={busy} className="danger-quiet" aria-label={`Delete ${item.name}`} onClick={() => onDelete({ name: item.name, path: `documents/${item.id}`, project: false })}>Delete</button></div></li>)}</ul>
      {!p.items.length && <p>No documents yet. Add one using the form above.</p>}
    </section>)}
    {rows.length > 0 && <nav className="admin-pagination" aria-label="JSON file pages"><span>Page {current} of {pages}</span><div className="admin-actions"><button disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button><button disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button></div></nav>}
  </>;
}
