import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { migrate } from '../schema/document';
import { exportPreviewPdf } from '../lib/pdfExport';
import { issueApi } from './api';
import { assignIssuePages, contentsEntries, defaultIssuePlan, reconcileIssuePlan, CONTENTS_ID, type IssueItem, type IssuePlan, type IssueResponse } from './model';
import { IssueRenderer, type RenderedIssueDocument } from './IssueRenderer';
import { IssuePreview } from './IssuePreview';
import { IssueOrder } from './IssueOrder';
import { useIssueAutosave } from './useIssueAutosave';
import './issue.css';

export default function IssueWorkspace({ projectId, csrf, onClose }: { projectId: string; csrf: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState<IssueResponse | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null); setError('');
    void issueApi<IssueResponse>(projectId, csrf, '', 'GET', undefined, controller.signal).then(data => {
      const items = data.items.map(item => ({ ...item, doc: migrate(item.doc) }));
      setLoaded({ ...data, items });
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to open this project.'); });
    return () => controller.abort();
  }, [projectId, csrf, reload]);
  if (!loaded) return <main className="issue-workspace"><header className="issue-header"><span className="issue-brand">Magazoo!</span><button onClick={onClose}>Back to library</button></header><div className="issue-loading-card">{error ? <><h1>Could not open this issue</h1><p role="alert">{error}</p><button onClick={() => setReload(value => value + 1)}>Try again</button></> : <><h1>Opening your project</h1><p>Loading its saved articles and issue arrangement…</p><div className="loading-track"><span /></div></>}</div></main>;
  return <IssueEditor key={`${projectId}-${reload}`} data={loaded} csrf={csrf} onClose={onClose} onReload={() => setReload(value => value + 1)} />;
}

function IssueEditor({ data, csrf, onClose, onReload }: { data: IssueResponse; csrf: string; onClose: () => void; onReload: () => void }) {
  const [items, setItems] = useState<IssueItem[]>(data.items);
  const [plan, setPlan] = useState<IssuePlan>(() => data.plan ? reconcileIssuePlan(data.plan, data.items) : defaultIssuePlan(data.items));
  const [rendered, setRendered] = useState<RenderedIssueDocument[]>([]);
  const [renderError, setRenderError] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ completed: 0, total: items.length, name: '' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [contentsOverflow, setContentsOverflow] = useState(true);
  const [finalizedPlan, setFinalizedPlan] = useState('');
  const [notice, setNotice] = useState('');
  const restoredFinalization = useRef(false);
  const pagesRef = useRef<HTMLDivElement>(null);
  const save = useIssueAutosave(data.project.id, csrf, plan, data.version, data.plan);
  // The source documents never change when ordering, numbering or saving the plan.
  const sources = useMemo(() => data.items.map(({ id, name, doc }) => ({ id, name, doc })), [data.items]);
  const ready = rendered.length === items.length;
  const counts = useMemo(() => Object.fromEntries(rendered.map(article => [article.id, article.pageCount])), [rendered]);
  const numbering = useMemo(() => {
    try { return { assignments: ready ? assignIssuePages(plan, items, counts) : [], error: '' }; }
    catch (failure) { return { assignments: [], error: failure instanceof Error ? failure.message : 'Page numbering needs adjustment.' }; }
  }, [ready, plan, items, counts]);
  const assignments = numbering.assignments;
  const entries = useMemo(() => ready && !numbering.error ? contentsEntries(plan, items, assignments) : [], [ready, plan, items, assignments, numbering.error]);
  const physicalPages = assignments.reduce((total, row) => total + row.pageCount, 0);
  const isFinalized = finalizedPlan === JSON.stringify(plan);
  useEffect(() => {
    if (!ready || restoredFinalization.current) return;
    restoredFinalization.current = true;
    if (!data.sourcesChanged && data.finalized && data.plan && data.finalized.documents.every(saved => assignments.some(row => row.id === saved.id && row.pageCount === saved.pageCount && row.startNumber === saved.startNumber))) setFinalizedPlan(JSON.stringify(data.plan));
  }, [ready, data, assignments]);
  const onComplete = useCallback((result: RenderedIssueDocument[]) => { setRendered(result); setRenderError(''); }, []);
  const onError = useCallback((failure: Error) => setRenderError(failure.message), []);
  const onProgress = useCallback((completed: number, total: number, name: string) => setProgress({ completed, total, name }), []);
  const updatePlan = (next: IssuePlan) => { setPlan(next); setNotice(''); };
  const reloadArticles = () => {
    if (save.status !== 'saved' && !window.confirm('Reload the saved arrangement and articles? Your unsaved arrangement changes will be discarded.')) return;
    onReload();
  };
  const execute = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'The operation could not be completed.'); }
    finally { setBusy(false); }
  };
  const finalize = () => execute(async () => {
    if (!ready || contentsOverflow || numbering.error) throw new Error(numbering.error || 'Finish preparing the pages and resolve the contents layout before finalising.');
    const version = await save.flush();
    const documents = assignments.filter(row => row.id !== CONTENTS_ID).map(row => ({ id: row.id, version: items.find(item => item.id === row.id)!.version, startNumber: row.startNumber, pageCount: row.pageCount }));
    const result = await issueApi<{ version: number; items: { id: string; version: number }[] }>(data.project.id, csrf, '/finalize', 'POST', { version, plan, documents });
    save.acceptFinalizedVersion(result.version);
    setItems(previous => previous.map(item => ({ ...item, version: result.items.find(updated => updated.id === item.id)?.version ?? item.version })));
    setFinalizedPlan(JSON.stringify(plan));
    setNotice('Issue finalised. Starting page numbers are saved to every article. Your two-page contents spread is ready.');
  });
  const exportIssue = () => execute(async () => {
    setShowAll(true);
    await new Promise<void>(resolve => window.setTimeout(resolve, 60));
    const root = pagesRef.current;
    if (!root || root.querySelectorAll(':scope > .page').length !== physicalPages) throw new Error('The complete issue preview is still loading. Try exporting again.');
    await exportPreviewPdf(data.project.name, root);
  });
  return <main className="issue-workspace" aria-busy={busy}>
    <header className="issue-header"><div><span className="issue-brand">Magazoo!</span><span className="issue-header-label">Issue studio</span></div><div className="issue-header-actions"><span className={`issue-save-status is-${save.status}`} role="status">{save.status === 'saved' ? 'Arrangement saved' : save.status === 'saving' ? 'Saving arrangement…' : save.status === 'pending' ? 'Unsaved arrangement' : 'Arrangement not saved'}</span><button disabled={busy} onClick={() => void execute(async () => { await save.flush(); onClose(); })}>Back to library</button></div></header>
    <div className="issue-intro"><div><p className="issue-eyebrow">From articles to an issue</p><h1>{data.project.name}</h1><p>Arrange your articles, review the contents spread, then finalise the page numbers.</p></div><div className="issue-stat"><strong>{items.length}</strong><span>articles</span></div><div className="issue-stat"><strong>{ready ? physicalPages : '…'}</strong><span>physical pages</span></div><div className="issue-stat"><strong>2</strong><span>contents pages</span></div></div>
    {(error || save.error || numbering.error) && <div className="issue-message is-error" role="alert"><span>{error || save.error || numbering.error}</span>{!numbering.error && <><button disabled={busy} onClick={() => void execute(() => save.flush().then(() => {}))}>Retry save</button><button disabled={busy} onClick={reloadArticles}>Reload current articles</button></>}</div>}
    {data.sourcesChanged && !isFinalized && <div className="issue-message">Some articles changed since the last finalisation. Review the refreshed page counts, then finalise again.</div>}
    {notice && <div className="issue-message is-success" role="status">{notice}</div>}
    <div className="issue-body">
      <aside className="issue-arrangement"><section className="issue-card"><div className="issue-section-title"><h2>Reading order</h2><button disabled={busy || save.status !== 'saved'} onClick={onReload}>Refresh articles</button></div><IssueOrder plan={plan} items={items} assignments={assignments} disabled={busy} onChange={updatePlan} /></section>
        <section className="issue-card"><h2>Page numbering</h2><label>First numbered page<input type="number" min="0" max="99999" step="1" value={plan.startNumber} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isSafeInteger(value) && value >= 0 && value <= 99999) updatePlan({ ...plan, startNumber: value }); }} /></label><label className="issue-checkbox"><input type="checkbox" disabled={busy} checked={plan.countCovers} onChange={event => updatePlan({ ...plan, countCovers: event.target.checked })} />Count front and back covers in numbering</label><p className="issue-help">Covers keep their page numbers hidden. Article footer visibility and placement follow each article’s design.</p></section>
        <section className="issue-card"><h2>Contents spread</h2><label>Heading<input maxLength={100} value={plan.contentsTitle} disabled={busy} onChange={event => updatePlan({ ...plan, contentsTitle: event.target.value })} /></label><label>Introduction<textarea rows={2} maxLength={500} value={plan.contentsSubtitle} disabled={busy} onChange={event => updatePlan({ ...plan, contentsSubtitle: event.target.value })} /></label><label>Contents reading direction<select value={plan.direction} disabled={busy} onChange={event => updatePlan({ ...plan, direction: event.target.value as 'ltr' | 'rtl' })}><option value="ltr">Left to right</option><option value="rtl">Arabic · right to left</option></select></label><p className="issue-help">Titles, subtitles and hero images come from the saved articles. Uncheck “List in contents” for covers or supporting pages. Refresh articles to pick up later edits.</p></section>
      </aside>
      <section className="issue-proof"><div className="issue-proof-toolbar"><div><h2>{showAll ? 'Complete issue' : 'Contents spread'}</h2><p>{ready ? `${entries.length} entries · ${isFinalized ? 'Finalised' : 'Draft preview'}` : 'Preparing the actual page layouts…'}</p></div><div className="issue-view-toggle"><button aria-pressed={!showAll} onClick={() => setShowAll(false)}>Contents</button><button aria-pressed={showAll} disabled={!ready} onClick={() => setShowAll(true)}>All pages</button></div></div>
        {!ready ? <div className="issue-preparing" role="status"><div className="issue-preparing-symbol">M<span>!</span></div><h3>{renderError ? 'An article needs attention' : 'Preparing your issue'}</h3><p>{renderError || `Measuring ${progress.name || 'article layouts'} using the editor’s page engine.`}</p><progress value={progress.completed} max={Math.max(1, progress.total)} /><p>{progress.completed} of {progress.total} articles prepared</p>{renderError && <button onClick={() => { setRenderError(''); setAttempt(value => value + 1); }}>Try again</button>}</div> : <IssuePreview plan={plan} entries={entries} assignments={assignments} rendered={rendered} showAll={showAll} magazineName={data.project.name} pagesRef={pagesRef} onOverflow={setContentsOverflow} />}
        {ready && contentsOverflow && <div className="issue-message is-error" role="alert">The contents text does not fit its two pages. Shorten the heading/introduction or uncheck some “List in contents” entries before finalising.</div>}
      </section>
    </div>
    <footer className="issue-actionbar"><div><strong>{isFinalized ? 'Issue finalised' : 'Ready when you are'}</strong><span>{busy ? 'Working… Please wait.' : 'Finalising updates page numbers in the project’s saved articles.'}</span></div><div><button disabled={busy || !ready || contentsOverflow || !!numbering.error} onClick={() => void exportIssue()}>{busy ? 'Please wait…' : 'Export issue PDF'}</button><button className="primary" disabled={busy || !ready || contentsOverflow || !!numbering.error || isFinalized || save.status === 'error' || items.length === 0} onClick={() => void finalize()}>{isFinalized ? 'Finalised ✓' : busy ? 'Working…' : 'Finalise issue & page numbers'}</button></div></footer>
    {!ready && !renderError && <IssueRenderer key={attempt} documents={sources} onComplete={onComplete} onError={onError} onProgress={onProgress} />}
  </main>;
}
