import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { migrate } from '../schema/document';
import { exportIssuePdf, issuePageGroups } from '../lib/pdfExport';
import { issueApi } from './api';
import { assignIssuePages, contentsDesignOf, contentsEntries, defaultIssuePlan, issuePlainText, reconcileIssuePlan, CONTENTS_ID, type ContentsDensity, type ContentsDesign, type ContentsEntryStyle, type ContentsLayout, type IssueItem, type IssuePlan, type IssueResponse } from './model';
import { IssueRenderer, type RenderedIssueDocument } from './IssueRenderer';
import { IssueRenderTarget } from './IssueRenderTarget';
import { IssueOrder } from './IssueOrder';
import { useIssueAutosave } from './useIssueAutosave';
import './issue.css';
import { Wordmark } from '../components/Wordmark';

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
  if (!loaded) return <main className="issue-workspace"><header className="issue-header"><Wordmark className="issue-brand" /><button onClick={onClose}>Back to library</button></header><div className="issue-loading-card">{error ? <><h1>Could not open this issue</h1><p role="alert">{error}</p><button onClick={() => setReload(value => value + 1)}>Try again</button></> : <><h1>Opening your project</h1><p>Loading its saved articles and issue arrangement…</p><div className="loading-track"><span /></div></>}</div></main>;
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
  const contentsDesign = useMemo(() => contentsDesignOf(plan), [plan]);
  const contentsItems = useMemo(() => plan.order
    .filter(id => id !== CONTENTS_ID && !plan.contentsExcluded.includes(id))
    .map(id => items.find(item => item.id === id))
    .filter((item): item is IssueItem => !!item), [plan.order, plan.contentsExcluded, items]);
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
  const updateDesign = (patch: Partial<ContentsDesign>) => updatePlan({ ...plan, contentsDesign: { ...contentsDesign, ...patch } });
  const updateEntryStyle = (id: string, patch: Partial<ContentsEntryStyle>) => {
    const next: ContentsEntryStyle = { ...(plan.contentsStyle?.[id] ?? {}), ...patch };
    // An empty override is the same as no override, EXCEPT an explicitly
    // empty deck, which means "hide the subtitle" rather than "unset it".
    (Object.keys(next) as (keyof ContentsEntryStyle)[]).forEach(key => {
      if (next[key] === undefined) delete next[key];
      else if (key !== 'deck' && next[key] === '') delete next[key];
    });
    const contentsStyle = { ...(plan.contentsStyle ?? {}) };
    if (Object.keys(next).length) contentsStyle[id] = next; else delete contentsStyle[id];
    updatePlan({ ...plan, contentsStyle });
  };
  const resetEntryStyle = (id: string) => {
    const contentsStyle = { ...(plan.contentsStyle ?? {}) };
    delete contentsStyle[id];
    updatePlan({ ...plan, contentsStyle });
  };
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
    // Every article is now a live preview that paginates on mount, so the
    // export waits for the sheets to actually exist instead of assuming one
    // frame is enough. A sheet is a `.page` sitting directly in a `.pages`
    // container; the hidden measuring twins never are.
    const sheetCount = (root: HTMLElement) => issuePageGroups(root).reduce((total, group) => total + group.sheets.length, 0);
    let root: HTMLDivElement | null = null;
    for (let attempt = 0; attempt < 100; attempt++) {
      root = pagesRef.current;
      if (root && sheetCount(root) === physicalPages) break;
      root = null;
      await new Promise<void>(resolve => window.setTimeout(resolve, 100));
    }
    if (!root) throw new Error('The complete issue preview is still loading. Try exporting again.');
    await exportIssuePdf(data.project.name, root);
  });
  return <main className="issue-workspace" aria-busy={busy}>
    <header className="issue-header"><div><Wordmark className="issue-brand" /><span className="issue-header-label">Issue studio</span></div><div className="issue-header-actions"><span className={`issue-save-status is-${save.status}`} role="status">{save.status === 'saved' ? 'Arrangement saved' : save.status === 'saving' ? 'Saving arrangement…' : save.status === 'pending' ? 'Unsaved arrangement' : 'Arrangement not saved'}</span><button disabled={busy} onClick={() => void execute(async () => { await save.flush(); onClose(); })}>Back to library</button></div></header>
    <div className="issue-intro"><div><p className="issue-eyebrow">From articles to an issue</p><h1>{data.project.name}</h1><p>Arrange your articles below and check the compiled preview alongside them — it's built page-for-page with the exact engine each article's own editor preview uses, so what you see there is exactly what exports.</p></div><div className="issue-stat"><strong>{items.length}</strong><span>articles</span></div><div className="issue-stat"><strong>{ready ? physicalPages : '…'}</strong><span>physical pages</span></div><div className="issue-stat"><strong>2</strong><span>contents pages</span></div></div>
    {(error || save.error || numbering.error) && <div className="issue-message is-error" role="alert"><span>{error || save.error || numbering.error}</span>{!numbering.error && <><button disabled={busy} onClick={() => void execute(() => save.flush().then(() => {}))}>Retry save</button><button disabled={busy} onClick={reloadArticles}>Reload current articles</button></>}</div>}
    {data.sourcesChanged && !isFinalized && <div className="issue-message">Some articles changed since the last finalisation. Review the refreshed page counts, then finalise again.</div>}
    {notice && <div className="issue-message is-success" role="status">{notice}</div>}
    <div className="issue-body">
      <div className="issue-controls">
      <section className="issue-card"><div className="issue-section-title"><h2>Reading order</h2><button disabled={busy || save.status !== 'saved'} onClick={onReload}>Refresh articles</button></div><IssueOrder plan={plan} items={items} assignments={assignments} disabled={busy} onChange={updatePlan} /></section>
      <section className="issue-card"><h2>Page numbering</h2><label>First numbered page<input type="number" min="0" max="99999" step="1" value={plan.startNumber} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isSafeInteger(value) && value >= 0 && value <= 99999) updatePlan({ ...plan, startNumber: value }); }} /></label><label className="issue-checkbox"><input type="checkbox" disabled={busy} checked={plan.countCovers} onChange={event => updatePlan({ ...plan, countCovers: event.target.checked })} />Count front and back covers in numbering</label><p className="issue-help">Covers keep their page numbers hidden. Article footer visibility and placement follow each article’s design.</p></section>
      <section className="issue-card"><h2>Contents spread</h2><label>Heading<input maxLength={100} value={plan.contentsTitle} disabled={busy} onChange={event => updatePlan({ ...plan, contentsTitle: event.target.value })} /></label><label>Introduction<textarea rows={2} maxLength={500} value={plan.contentsSubtitle} disabled={busy} onChange={event => updatePlan({ ...plan, contentsSubtitle: event.target.value })} /></label><label>Contents reading direction<select value={plan.direction} disabled={busy} onChange={event => updatePlan({ ...plan, direction: event.target.value as 'ltr' | 'rtl' })}><option value="ltr">Left to right</option><option value="rtl">Arabic · right to left</option></select></label><p className="issue-help">Titles, subtitles and hero images come from the saved articles. Uncheck “List in contents” for covers or supporting pages. Refresh articles to pick up later edits.</p></section>
      <section className="issue-card">
        <div className="issue-section-title"><h2>Contents design</h2><button type="button" disabled={busy} onClick={() => updatePlan({ ...plan, contentsDesign: undefined })}>Reset to defaults</button></div>
        <div className="issue-card-grid">
          <label>Layout<select value={contentsDesign.layout} disabled={busy} onChange={event => updateDesign({ layout: event.target.value as ContentsLayout })}><option value="sections">Sectioned list</option><option value="feature">Lead feature + grid</option></select></label>
          <label>Density<select value={contentsDesign.density} disabled={busy} onChange={event => updateDesign({ density: event.target.value as ContentsDensity })}><option value="auto">Auto — fills the page</option><option value="airy">Airy</option><option value="normal">Normal</option><option value="dense">Dense</option><option value="packed">Packed</option></select></label>
          {contentsDesign.layout === 'feature' && <label>List columns<select value={contentsDesign.columns} disabled={busy} onChange={event => updateDesign({ columns: Number(event.target.value) as 1 | 2 })}><option value={1}>1</option><option value={2}>2</option></select></label>}
          <label>Headline font<select value={contentsDesign.titleFont} disabled={busy} onChange={event => updateDesign({ titleFont: event.target.value as 'serif' | 'sans' })}><option value="serif">Serif — Playfair Display</option><option value="sans">Sans — Avenir Next</option></select></label>
          <label>Accent colour<input type="color" value={contentsDesign.accent} disabled={busy} style={{ width: 56, padding: 2 }} onChange={event => updateDesign({ accent: event.target.value })} /></label>
          <label>Heading colour<input type="color" value={contentsDesign.headingColor} disabled={busy} style={{ width: 56, padding: 2 }} onChange={event => updateDesign({ headingColor: event.target.value })} /></label>
          <label>Feature image height<input type="number" min={20} max={150} step={1} value={contentsDesign.featureHeight} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) updateDesign({ featureHeight: value }); }} /></label>
          <label>Thumbnail height<input type="number" min={8} max={90} step={1} value={contentsDesign.thumbHeight} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) updateDesign({ thumbHeight: value }); }} /></label>
          <label>Text size <span className="issue-range-value">{Math.round(contentsDesign.textScale * 100)}%</span><input type="range" min={0.85} max={1.15} step={0.01} value={contentsDesign.textScale} disabled={busy} onChange={event => updateDesign({ textScale: event.target.valueAsNumber })} /></label>
          <label>Character spacing <span className="issue-range-value">{contentsDesign.tracking >= 0 ? '+' : ''}{contentsDesign.tracking.toFixed(3)}em</span><input type="range" min={-0.02} max={0.04} step={0.005} value={contentsDesign.tracking} disabled={busy} onChange={event => updateDesign({ tracking: event.target.valueAsNumber })} /></label>
          <label>Gaps <span className="issue-range-value">{Math.round(contentsDesign.gapScale * 100)}%</span><input type="range" min={0.7} max={1.3} step={0.05} value={contentsDesign.gapScale} disabled={busy} onChange={event => updateDesign({ gapScale: event.target.valueAsNumber })} /></label>
          <label className="issue-checkbox"><input type="checkbox" checked={contentsDesign.showHeroes} disabled={busy} onChange={event => updateDesign({ showHeroes: event.target.checked })} />Show hero images</label>
          <label className="issue-checkbox"><input type="checkbox" checked={contentsDesign.pageLabels} disabled={busy} onChange={event => updateDesign({ pageLabels: event.target.checked })} />Page-number chip on photos</label>
          <label className="issue-checkbox"><input type="checkbox" checked={contentsDesign.rules} disabled={busy} onChange={event => updateDesign({ rules: event.target.checked })} />Dividing rules</label>
          <label className="issue-checkbox"><input type="checkbox" checked={contentsDesign.paddedNumbers} disabled={busy} onChange={event => updateDesign({ paddedNumbers: event.target.checked })} />Zero-padded numbers (01, 02…)</label>
        </div>
        <p className="issue-help">Density decides how much each page tries to hold before shrinking; on Auto it steps down only as far as it must to still fit two pages. Text size, character spacing and gaps apply on top of whichever density ends up showing.</p>
      </section>
      <section className="issue-card">
        <h2>Contents entries</h2>
        <p className="issue-help">Override what a listed article shows on the contents page, independently of the article itself — handy when the real subtitle is too long for a contents line.</p>
        <div className="issue-entry-list">
          {contentsItems.length === 0 && <p className="issue-help">No articles are listed in the contents spread yet.</p>}
          {contentsItems.map(item => {
            const style = plan.contentsStyle?.[item.id] ?? {};
            const realTitle = issuePlainText(item.doc.meta.title) || item.name.replace(/\.json$/iu, '');
            const realSubtitle = issuePlainText(item.doc.meta.subtitle);
            const hidden = style.deck === '';
            const custom = typeof style.deck === 'string' && style.deck !== '';
            const overridden = Object.keys(style).length > 0;
            return <div key={item.id} className="issue-entry-row" data-entry-id={item.id}>
              <div className="issue-entry-row-head"><strong dir="auto">{style.title || realTitle}</strong>{overridden && <button type="button" disabled={busy} onClick={() => resetEntryStyle(item.id)}>Reset</button>}</div>
              <label>Title on contents page<input maxLength={140} placeholder={realTitle} value={style.title ?? ''} disabled={busy} onChange={event => updateEntryStyle(item.id, { title: event.target.value || undefined })} /></label>
              <label className="issue-checkbox"><input type="checkbox" checked={!hidden} disabled={busy} onChange={event => updateEntryStyle(item.id, { deck: event.target.checked ? undefined : '' })} />Show a subtitle</label>
              {!hidden && <label>Subtitle on contents page{!custom && realSubtitle && <span className="issue-entry-hint"> — using the article’s own</span>}<textarea rows={2} maxLength={240} placeholder={realSubtitle || 'No subtitle on the article itself'} value={style.deck ?? ''} disabled={busy} onChange={event => updateEntryStyle(item.id, { deck: event.target.value || undefined })} /></label>}
              <div className="issue-entry-row-pair">
                <label>Badge<input maxLength={30} placeholder="e.g. COVER STORY" value={style.badge ?? ''} disabled={busy} onChange={event => updateEntryStyle(item.id, { badge: event.target.value || undefined })} /></label>
                <label>Section<input maxLength={40} placeholder="e.g. Research" value={style.section ?? ''} disabled={busy} onChange={event => updateEntryStyle(item.id, { section: event.target.value || undefined })} /></label>
              </div>
            </div>;
          })}
        </div>
      </section>
      <section className="issue-card">
        <h2>Compile &amp; export</h2>
        {!ready
          ? <div className="issue-preparing" role="status"><Wordmark className="issue-preparing-symbol" /><h3>{renderError ? 'An article needs attention' : 'Preparing your issue'}</h3><p>{renderError || `Measuring ${progress.name || 'article layouts'} using the editor’s page engine.`}</p><progress value={progress.completed} max={Math.max(1, progress.total)} /><p>{progress.completed} of {progress.total} articles prepared</p>{renderError && <button onClick={() => { setRenderError(''); setAttempt(value => value + 1); }}>Try again</button>}</div>
          : <p className="issue-help">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} in the contents spread · {physicalPages} physical pages{isFinalized ? ' · Finalised' : ''}. The compiled preview alongside is the exact engine each article’s own editor uses — it’s what exports.</p>}
        {ready && contentsOverflow && <div className="issue-message is-error" role="alert">The contents text does not fit its two pages. Shorten the heading/introduction or uncheck some “List in contents” entries before finalising.</div>}
      </section>
      </div>
      <div className="issue-proof">
        <div className="issue-proof-label"><span>Compiled preview</span>{ready && <span>{physicalPages} {physicalPages === 1 ? 'page' : 'pages'}</span>}</div>
        {ready
          ? <IssueRenderTarget plan={plan} entries={entries} assignments={assignments} items={items} showAll={true} magazineName={data.project.name} design={contentsDesign} pagesRef={pagesRef} onOverflow={setContentsOverflow} />
          : <div className="issue-proof-empty" role="status">Preparing the compiled preview…</div>}
      </div>
    </div>
    <footer className="issue-actionbar"><div><strong>{isFinalized ? 'Issue finalised' : 'Ready when you are'}</strong><span>{busy ? 'Working… Please wait.' : 'Finalising updates page numbers in the project’s saved articles.'}</span></div><div><button disabled={busy || !ready || contentsOverflow || !!numbering.error} onClick={() => void exportIssue()}>{busy ? 'Please wait…' : 'Export issue PDF'}</button><button className="primary" disabled={busy || !ready || contentsOverflow || !!numbering.error || isFinalized || save.status === 'error' || items.length === 0} onClick={() => void finalize()}>{isFinalized ? 'Finalised ✓' : busy ? 'Working…' : 'Finalise issue & page numbers'}</button></div></footer>
    {!ready && !renderError && <IssueRenderer key={attempt} documents={sources} onComplete={onComplete} onError={onError} onProgress={onProgress} />}
  </main>;
}
