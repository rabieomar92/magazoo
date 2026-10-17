import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AdminIcon } from './AdminIcon';
import { ArticleHero } from './ArticleHero';
import { articleLabel, articleCategory, libraryRows, type LibraryItem, type LibraryProject, type LibrarySort } from './libraryModel';

export interface DeleteTarget { name: string; path: string; project: boolean }

export default function AdminLibrary({ projects, busy, onDelete, onCopy, link, onCompile, onRename }: {
  projects: LibraryProject[]; busy: boolean; onDelete: (target: DeleteTarget) => void;
  onCopy: (item: LibraryItem) => void; link: (token: string) => string;
  onCompile?: (projectId: string) => void;
  onRename?: (project: LibraryProject) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(12);
  const [sort, setSort] = useState<LibrarySort>('recent');
  const libraryRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const [pageNavigation, setPageNavigation] = useState(false);
  const filter = projects.some(p => p.id === projectId) ? projectId : '';
  const rows = useMemo(() => libraryRows(projects, query, filter, sort), [projects, query, filter, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  useEffect(() => {
    if (!pageNavigation) return;
    libraryRef.current?.scrollIntoView?.({block:'start'});
    resultRef.current?.focus({preventScroll:true});
    setPageNavigation(false);
  }, [current, pageNavigation]);
  const goToPage = (next: number) => { setPage(next); setPageNavigation(true); };
  const visible = rows.slice((current - 1) * size, current * size);
  const groups = new Map<string, { project: LibraryProject; items: LibraryItem[] }>();
  for (const { project, item } of visible) {
    if (!groups.has(project.id)) groups.set(project.id, { project, items: [] });
    if (item) groups.get(project.id)!.items.push(item);
  }
  const clear = () => { setQuery(''); setProjectId(''); setPage(1); };
  return <div className="admin-library" ref={libraryRef}>
    <div className="admin-library-controls" role="search" aria-label="Article library search">
      <label className="admin-search">Search articles
        <span className="admin-search-field"><AdminIcon name="search"/><input type="search" aria-label="Search articles" value={query} placeholder="Search by file or project name…" aria-describedby={`${id}-search-help`} onChange={e => { setQuery(e.target.value); setPage(1); }} />{query && <button type="button" className="admin-icon-button" aria-label="Clear search" onClick={() => { setQuery(''); setPage(1); }}><AdminIcon name="close"/></button>}</span>
      </label>
      <label>Project<select value={filter} onChange={e => { setProjectId(e.target.value); setPage(1); }}><option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Articles in each project<select value={sort} onChange={e => { setSort(e.target.value as LibrarySort); setPage(1); }}><option value="recent">Newest updates</option><option value="oldest">Oldest updates</option><option value="name">Name: A–Z</option></select></label>
    </div>
    <div className="admin-result-bar">
      <p className="admin-result-count" ref={resultRef} tabIndex={-1} role="status" aria-live="polite">{rows.length ? <><strong>{(current - 1) * size + 1}–{Math.min(current * size, rows.length)}</strong> of {rows.length} results</> : 'No results'}{(query || filter) && <button type="button" className="admin-text-button" onClick={clear}>Clear filters</button>}</p>
      <p id={`${id}-search-help`}>Searches all pages · Empty projects are included</p>
    </div>
    {!rows.length && <section className="admin-card admin-empty"><span className="admin-empty-icon"><AdminIcon name={projects.length ? 'search' : 'folder'}/></span><h3>{projects.length ? 'No matching documents.' : 'No projects yet.'}</h3><p>{projects.length ? 'Try a different file name or choose another project.' : 'Create a project, then add an article or import an existing JSON file.'}</p></section>}
    {[...groups.values()].map(({ project: p, items }) => <section className="admin-project" key={p.id} aria-labelledby={`${id}-project-${p.id}`}>
      <header className="admin-project-header"><div className="admin-project-heading"><span className="admin-project-icon"><AdminIcon name="folder"/></span><div><h3 id={`${id}-project-${p.id}`}>{p.name}</h3><span>{p.items.length} {p.items.length === 1 ? 'article' : 'articles'} in project{p.items.length > items.length && items.length > 0 ? ` · ${items.length} shown` : ''}</span></div></div><div className="admin-actions">{onCompile && <button className="admin-compile" disabled={busy || !p.items.length} onClick={() => onCompile(p.id)}><AdminIcon name="grid"/>Compile issue</button>}{onRename && <button disabled={busy} onClick={() => onRename(p)} aria-label={`Rename project ${p.name}`}>Rename</button>}<button disabled={busy} className="admin-icon-button danger-quiet" title={`Delete project ${p.name}`} aria-label={`Delete project ${p.name}`} onClick={() => onDelete({ name: p.name, path: `projects/${p.id}`, project: true })}><AdminIcon name="trash"/></button></div></header>
      <ul className="admin-article-grid" role="list">{items.map(item => {
        const date = new Date(item.updated);
        const validDate = Number.isFinite(date.getTime());
        return <li className="admin-article-card" key={item.id}>
          <ArticleHero key={`${item.id}:${item.version}`} item={item} href={link(item.token)}/>
          <div className="admin-article-top"><span className="admin-file-icon"><AdminIcon name="article"/></span><span className="admin-file-kind" title={articleCategory(item)}>{articleCategory(item)}</span><span className="admin-version" title={`Saved version ${item.version}`}>v{item.version}</span></div>
          <h4><a href={link(item.token)} target="_blank" rel="noreferrer" title={item.name}>{articleLabel(item.name)}</a></h4>
          <p className="admin-filename" title={item.name}>{item.name}</p>
          <div className="admin-article-meta"><span className="admin-private"><AdminIcon name="shield"/>Private link</span><span title={validDate ? date.toLocaleString() : undefined}>Updated {validDate ? <time dateTime={date.toISOString()}>{date.toLocaleDateString(undefined, {day:'numeric',month:'short',year:'numeric'})}</time> : '—'}</span></div>
          <div className="admin-article-actions"><a className="admin-edit-link" href={link(item.token)} target="_blank" rel="noreferrer" aria-label={`Edit ${item.name}`}>Open editor<AdminIcon name="arrow"/></a><div><button type="button" disabled={busy} className="admin-copy-link" aria-label={`Copy private link for ${item.name}`} onClick={() => onCopy(item)}><AdminIcon name="link"/>Copy link</button><button type="button" disabled={busy} className="admin-icon-button danger-quiet" title={`Delete ${item.name}`} aria-label={`Delete ${item.name}`} onClick={() => onDelete({ name: item.name, path: `documents/${item.id}`, project: false })}><AdminIcon name="trash"/></button></div></div>
        </li>;
      })}</ul>
      {!p.items.length && <div className="admin-project-empty"><AdminIcon name="article"/><div><strong>No articles yet</strong><p>Use “Add article” above to create or import a document into this project.</p></div></div>}
    </section>)}
    {rows.length > 0 && <nav className="admin-pagination" aria-label="Article pages"><label>Cards per page<select value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }}>{[12,24,48].map(n => <option key={n} value={n}>{n}</option>)}</select></label><div className="admin-page-navigation"><span>Page {current} of {pages}</span><div className="admin-actions"><button disabled={current === 1} onClick={() => goToPage(current - 1)}>Previous</button><button disabled={current === pages} onClick={() => goToPage(current + 1)}>Next</button></div></div></nav>}
  </div>;
}
