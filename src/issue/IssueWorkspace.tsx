import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { migrate } from '../schema/document';
import { exportIssuePdf, issuePageGroups } from '../lib/pdfExport';
import { issueApi } from './api';
import { contentsDesignOf, contentsEntries, defaultIssuePlan, reconcileIssuePlan, CONTENTS_ID, type ContentsDensity, type ContentsDesign, type ContentsEntryStyle, type ContentsLayout, type IssueItem, type IssuePlan, type IssueResponse } from './model';
import { IssueCompiler, type CompiledIssue, type CompileProgress } from './IssueCompiler';
import { IssueProof } from './IssueProof';
import { ContentsEntryCard } from './ContentsEntryCards';
import { IssueOrder } from './IssueOrder';
import { useIssueAutosave } from './useIssueAutosave';
import './issue.css';
import { Wordmark } from '../components/Wordmark';

const PAGE_WIDTH_PX = (210 * 96) / 25.4;
const PAGE_HEIGHT_PX = (297 * 96) / 25.4;
/** What the compiled sheets are built from. Everything else an editor can
 * change — wording, colours, crops — is contents design, which the spread
 * re-renders on its own without re-setting the issue. */
const numberingKey = (plan: IssuePlan) => JSON.stringify([plan.order, plan.startNumber, plan.countCovers]);
const contentsKey = (plan: IssuePlan) => JSON.stringify([
  plan.contentsTitle, plan.contentsSubtitle, plan.direction, plan.contentsExcluded,
  plan.contentsDesign ?? null, plan.contentsStyle ?? null,
]);

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
  if (!loaded) return <main className="studio is-booting">
    <header className="studio-bar"><div className="studio-bar-lead"><Wordmark className="studio-brand" /><span className="studio-chip">Issue studio</span></div><button onClick={onClose}>Back to library</button></header>
    <div className="studio-boot">{error
      ? <><h1>Could not open this issue</h1><p role="alert">{error}</p><button className="primary" onClick={() => setReload(value => value + 1)}>Try again</button></>
      : <><h1>Opening your project</h1><p>Loading its saved articles and issue arrangement…</p><div className="loading-track"><span /></div></>}</div>
  </main>;
  return <IssueEditor key={`${projectId}-${reload}`} data={loaded} csrf={csrf} onClose={onClose} onReload={() => setReload(value => value + 1)} />;
}

type Tab = 'arrange' | 'contents' | 'entries' | 'output';
const TABS: { id: Tab; label: string }[] = [
  { id: 'arrange', label: 'Arrange' },
  { id: 'contents', label: 'Contents' },
  { id: 'entries', label: 'Entries' },
  { id: 'output', label: 'Output' },
];

function IssueEditor({ data, csrf, onClose, onReload }: { data: IssueResponse; csrf: string; onClose: () => void; onReload: () => void }) {
  const [items, setItems] = useState<IssueItem[]>(data.items);
  const [plan, setPlan] = useState<IssuePlan>(() => data.plan ? reconcileIssuePlan(data.plan, data.items) : defaultIssuePlan(data.items));
  /** The arrangement the sheets on screen were built from. Editing is free;
   * re-setting the issue is deliberate. */
  const [proofPlan, setProofPlan] = useState<IssuePlan>(plan);
  const [compiled, setCompiled] = useState<CompiledIssue | null>(null);
  const [compileToken, setCompileToken] = useState(0);
  const [renderError, setRenderError] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<CompileProgress>({ completed: 0, total: data.items.length, name: '', pass: 1, passes: 2 });
  const [busy, setBusy] = useState(false);
  const [contentsOverflow, setContentsOverflow] = useState(true);
  const [finalizedPlan, setFinalizedPlan] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('arrange');
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [fitScale, setFitScale] = useState(0.4);
  const [proofVersion, setProofVersion] = useState(0);
  const restoredFinalization = useRef(false);
  const pagesRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const save = useIssueAutosave(data.project.id, csrf, plan, data.version, data.plan);

  // A new array identity is what tells the compiler to set the issue again.
  const sources = useMemo(() => { void compileToken; return data.items.map(({ id, name, doc }) => ({ id, name, doc })); }, [data.items, compileToken]);
  const ready = !!compiled;
  const assignments = compiled?.assignments ?? [];
  const contentsDesign = useMemo(() => contentsDesignOf(plan), [plan]);
  const proofDesign = useMemo(() => contentsDesignOf(proofPlan), [proofPlan]);
  const entries = useMemo(() => {
    if (!compiled) return [];
    try { return contentsEntries(proofPlan, items, compiled.assignments); } catch { return []; }
  }, [compiled, proofPlan, items]);
  const contentsItems = useMemo(() => plan.order
    .filter(id => id !== CONTENTS_ID && !plan.contentsExcluded.includes(id))
    .map(id => items.find(item => item.id === id))
    .filter((item): item is IssueItem => !!item), [plan.order, plan.contentsExcluded, items]);
  const physicalPages = assignments.reduce((total, row) => total + row.pageCount, 0);
  const contentsStart = assignments.find(row => row.id === CONTENTS_ID)?.startNumber ?? plan.startNumber;
  const isFinalized = finalizedPlan === JSON.stringify(plan);
  const issueStale = ready && numberingKey(compiled!.plan) !== numberingKey(plan);
  const contentsStale = ready && contentsKey(proofPlan) !== contentsKey(plan);
  const proofStale = issueStale || contentsStale;

  useEffect(() => {
    if (!ready || restoredFinalization.current) return;
    restoredFinalization.current = true;
    if (!data.sourcesChanged && data.finalized && data.plan && data.finalized.documents.every(saved => assignments.some(row => row.id === saved.id && row.pageCount === saved.pageCount && row.startNumber === saved.startNumber))) setFinalizedPlan(JSON.stringify(data.plan));
  }, [ready, data, assignments]);

  // Fit a whole sheet in the stage — both directions, the way a proofing view
  // fits a page rather than only its width. Never above 100%: a preview that
  // magnified the paper would invite judging type sizes that are not real.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setFitScale(Math.min(1, Math.max(0.12,
      Math.min((stage.clientWidth - 44) / PAGE_WIDTH_PX, (stage.clientHeight - 44) / PAGE_HEIGHT_PX))));
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(stage);
    return () => observer?.disconnect();
  }, []);
  const scale = zoom === 'fit' ? fitScale : zoom;

  const onCompiled = useCallback((result: CompiledIssue) => {
    setCompiled(result);
    setProofPlan(result.plan);
    setRenderError('');
    setProofVersion(value => value + 1);
  }, []);
  const onCompileError = useCallback((failure: Error) => setRenderError(failure.message), []);
  const onProgress = useCallback((value: CompileProgress) => setProgress(value), []);

  const updatePlan = (next: IssuePlan) => { setPlan(next); setNotice(''); };
  const updateDesign = (patch: Partial<ContentsDesign>) => updatePlan({ ...plan, contentsDesign: { ...contentsDesign, ...patch } });
  const updateEntryStyle = (id: string, patch: Partial<ContentsEntryStyle>) => {
    const next: ContentsEntryStyle = { ...(plan.contentsStyle?.[id] ?? {}), ...patch };
    // An empty override is the same as no override, EXCEPT an explicitly
    // empty deck, which means "hide the subtitle" rather than "unset it",
    // and the booleans/null, which are meaningful values in themselves.
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
  const recompile = useCallback(() => {
    setCompiled(null); setRenderError(''); setNotice('');
    setProgress({ completed: 0, total: items.length, name: '', pass: 1, passes: 2 });
    setCompileToken(value => value + 1);
  }, [items.length]);
  const rebuildContents = useCallback(() => {
    // Wording and crops never move a folio, so the contents sheet can be
    // re-laid on its own. Anything that renumbers the issue cannot be, and
    // quietly showing a contents page numbered against a stale arrangement
    // is exactly the kind of error a proof exists to prevent.
    if (issueStale) { recompile(); return; }
    setProofPlan(plan);
    setProofVersion(value => value + 1);
    setNotice('');
  }, [issueStale, plan, recompile]);

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
    if (!ready || contentsOverflow || proofStale) throw new Error('Rebuild the compiled issue and resolve the contents layout before finalising.');
    const version = await save.flush();
    const documents = assignments.filter(row => row.id !== CONTENTS_ID).map(row => ({ id: row.id, version: items.find(item => item.id === row.id)!.version, startNumber: row.startNumber, pageCount: row.pageCount }));
    const result = await issueApi<{ version: number; items: { id: string; version: number }[] }>(data.project.id, csrf, '/finalize', 'POST', { version, plan, documents });
    save.acceptFinalizedVersion(result.version);
    setItems(previous => previous.map(item => ({ ...item, version: result.items.find(updated => updated.id === item.id)?.version ?? item.version })));
    setFinalizedPlan(JSON.stringify(plan));
    setNotice('Issue finalised. Starting page numbers are saved to every article. Your two-page contents spread is ready.');
  });
  const exportIssue = () => execute(async () => {
    const sheetCount = (root: HTMLElement) => issuePageGroups(root).reduce((total, group) => total + group.sheets.length, 0);
    let root: HTMLDivElement | null = null;
    for (let attempt = 0; attempt < 100; attempt++) {
      root = pagesRef.current;
      if (root && sheetCount(root) === physicalPages) break;
      root = null;
      await new Promise<void>(resolve => window.setTimeout(resolve, 100));
    }
    if (!root) throw new Error('The compiled issue is still being laid out. Try exporting again in a moment.');
    await exportIssuePdf(data.project.name, root);
  });

  const blocked = busy || !ready || contentsOverflow || proofStale;
  return <main className="studio" aria-busy={busy}>
    <header className="studio-bar">
      <div className="studio-bar-lead">
        <Wordmark className="studio-brand" />
        <span className="studio-chip">Issue studio</span>
        <span className="studio-project" dir="auto">{data.project.name}</span>
      </div>
      <div className="studio-bar-end">
        <span className={`save-pill is-${save.status}`} role="status">{save.status === 'saved' ? 'Saved' : save.status === 'saving' ? 'Saving…' : save.status === 'pending' ? 'Unsaved changes' : 'Not saved'}</span>
        <button disabled={busy} onClick={() => void execute(async () => { await save.flush(); onClose(); })}>Back to library</button>
      </div>
    </header>

    {(error || save.error) && <div className="banner is-error" role="alert"><span>{error || save.error}</span><button disabled={busy} onClick={() => void execute(() => save.flush().then(() => {}))}>Retry save</button><button disabled={busy} onClick={reloadArticles}>Reload articles</button></div>}
    {data.sourcesChanged && !isFinalized && <div className="banner">Some articles changed since the last finalisation. Recompile to pick up the new page counts, then finalise again.</div>}
    {notice && <div className="banner is-success" role="status">{notice}</div>}

    <div className="studio-shell">
      <aside className="inspector">
        <div className="inspector-metrics">
          <div><strong>{items.length}</strong><span>articles</span></div>
          <div><strong>{ready ? physicalPages : '—'}</strong><span>pages</span></div>
          <div><strong>{ready ? entries.length : '—'}</strong><span>listed</span></div>
        </div>
        <nav className="inspector-tabs" role="tablist" aria-label="Issue settings">
          {TABS.map(entry => <button key={entry.id} type="button" role="tab" id={`tab-${entry.id}`} aria-selected={tab === entry.id} aria-controls={`panel-${entry.id}`} className={tab === entry.id ? 'is-active' : ''} onClick={() => setTab(entry.id)}>{entry.label}</button>)}
        </nav>

        {tab === 'arrange' && <div className="panel" role="tabpanel" id="panel-arrange" aria-labelledby="tab-arrange">
          <section className="card">
            <div className="card-head"><h2>Reading order</h2><button disabled={busy || save.status !== 'saved'} onClick={onReload}>Refresh articles</button></div>
            <IssueOrder plan={plan} items={items} assignments={assignments} disabled={busy} onChange={updatePlan} />
          </section>
          <section className="card">
            <h2>Page numbering</h2>
            <label className="field">First numbered page
              <input type="number" min="0" max="99999" step="1" value={plan.startNumber} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isSafeInteger(value) && value >= 0 && value <= 99999) updatePlan({ ...plan, startNumber: value }); }} />
            </label>
            <label className="switch"><input type="checkbox" disabled={busy} checked={plan.countCovers} onChange={event => updatePlan({ ...plan, countCovers: event.target.checked })} /><span>Count front and back covers in numbering</span></label>
            <p className="field-hint">Covers keep their page numbers hidden. Footer placement follows each article’s own design. Changing the order or the first page renumbers the issue, so the sheets are set again.</p>
          </section>
        </div>}

        {tab === 'contents' && <div className="panel" role="tabpanel" id="panel-contents" aria-labelledby="tab-contents">
          <section className="card">
            <h2>Contents spread</h2>
            <label className="field">Heading<input maxLength={100} value={plan.contentsTitle} disabled={busy} onChange={event => updatePlan({ ...plan, contentsTitle: event.target.value })} /></label>
            <label className="field">Introduction<textarea rows={2} maxLength={500} value={plan.contentsSubtitle} disabled={busy} onChange={event => updatePlan({ ...plan, contentsSubtitle: event.target.value })} /></label>
            <label className="field">Reading direction<select value={plan.direction} disabled={busy} onChange={event => updatePlan({ ...plan, direction: event.target.value as 'ltr' | 'rtl' })}><option value="ltr">Left to right</option><option value="rtl">Right to left (Arabic)</option></select></label>
          </section>
          <section className="card">
            <div className="card-head"><h2>Design</h2><button type="button" disabled={busy} onClick={() => updatePlan({ ...plan, contentsDesign: undefined })}>Reset</button></div>
            <div className="field-grid">
              <label className="field">Layout<select value={contentsDesign.layout} disabled={busy} onChange={event => updateDesign({ layout: event.target.value as ContentsLayout })}><option value="sections">Sectioned list</option><option value="feature">Lead feature + grid</option></select></label>
              <label className="field">Density<select value={contentsDesign.density} disabled={busy} onChange={event => updateDesign({ density: event.target.value as ContentsDensity })}><option value="auto">Auto (fills page)</option><option value="airy">Airy</option><option value="normal">Normal</option><option value="dense">Dense</option><option value="packed">Packed</option></select></label>
              {contentsDesign.layout === 'feature' && <label className="field">List columns<select value={contentsDesign.columns} disabled={busy} onChange={event => updateDesign({ columns: Number(event.target.value) as 1 | 2 })}><option value={1}>1</option><option value={2}>2</option></select></label>}
              <label className="field">Headline font<select value={contentsDesign.titleFont} disabled={busy} onChange={event => updateDesign({ titleFont: event.target.value as 'serif' | 'sans' })}><option value="serif">Serif · Playfair</option><option value="sans">Sans · Avenir Next</option></select></label>
              <label className="field swatch">Accent<input type="color" value={contentsDesign.accent} disabled={busy} onChange={event => updateDesign({ accent: event.target.value })} /></label>
              <label className="field swatch">Headings<input type="color" value={contentsDesign.headingColor} disabled={busy} onChange={event => updateDesign({ headingColor: event.target.value })} /></label>
              <label className="field">Feature picture (mm)<input type="number" min={20} max={150} step={1} value={contentsDesign.featureHeight} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) updateDesign({ featureHeight: value }); }} /></label>
              <label className="field">Thumbnail (mm)<input type="number" min={8} max={90} step={1} value={contentsDesign.thumbHeight} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) updateDesign({ thumbHeight: value }); }} /></label>
            </div>
            <label className="field range">Text size <b>{Math.round(contentsDesign.textScale * 100)}%</b><input type="range" min={0.85} max={1.15} step={0.01} value={contentsDesign.textScale} disabled={busy} onChange={event => updateDesign({ textScale: event.target.valueAsNumber })} /></label>
            <label className="field range">Character spacing <b>{contentsDesign.tracking >= 0 ? '+' : ''}{contentsDesign.tracking.toFixed(3)}em</b><input type="range" min={-0.02} max={0.04} step={0.005} value={contentsDesign.tracking} disabled={busy} onChange={event => updateDesign({ tracking: event.target.valueAsNumber })} /></label>
            <label className="field range">Gaps <b>{Math.round(contentsDesign.gapScale * 100)}%</b><input type="range" min={0.7} max={1.3} step={0.05} value={contentsDesign.gapScale} disabled={busy} onChange={event => updateDesign({ gapScale: event.target.valueAsNumber })} /></label>
            <div className="switch-set">
              <label className="switch"><input type="checkbox" checked={contentsDesign.showHeroes} disabled={busy} onChange={event => updateDesign({ showHeroes: event.target.checked })} /><span>Show pictures</span></label>
              <label className="switch"><input type="checkbox" checked={contentsDesign.pageLabels} disabled={busy} onChange={event => updateDesign({ pageLabels: event.target.checked })} /><span>Page chip on pictures</span></label>
              <label className="switch"><input type="checkbox" checked={contentsDesign.rules} disabled={busy} onChange={event => updateDesign({ rules: event.target.checked })} /><span>Dividing rules</span></label>
              <label className="switch"><input type="checkbox" checked={contentsDesign.paddedNumbers} disabled={busy} onChange={event => updateDesign({ paddedNumbers: event.target.checked })} /><span>Zero-padded numbers</span></label>
            </div>
            <p className="field-hint">Density decides how much each page tries to hold before shrinking; on Auto it steps down only as far as it must to still fit two pages. The three sliders apply on top of whichever density ends up showing.</p>
          </section>
        </div>}

        {tab === 'entries' && <div className="panel" role="tabpanel" id="panel-entries" aria-labelledby="tab-entries">
          <section className="card">
            <h2>Contents entries</h2>
            <p className="field-hint">Each line of the contents page, independent of the article it came from. Open one to reword it, drop or reframe its picture, or move it to another section.</p>
            <div className="entry-list">
              {contentsItems.length === 0 && <p className="field-hint">No articles are listed in the contents spread yet.</p>}
              {contentsItems.map((item, index) => <ContentsEntryCard
                key={item.id} item={item} index={index} design={contentsDesign} busy={busy} proofVersion={proofVersion}
                style={plan.contentsStyle?.[item.id] ?? {}}
                onChange={patch => updateEntryStyle(item.id, patch)}
                onReset={() => resetEntryStyle(item.id)}
              />)}
            </div>
          </section>
        </div>}

        {tab === 'output' && <div className="panel" role="tabpanel" id="panel-output" aria-labelledby="tab-output">
          <section className="card">
            <h2>Compile</h2>
            {ready
              ? <p className="field-hint">{physicalPages} physical pages across {items.length} {items.length === 1 ? 'article' : 'articles'}, {entries.length} listed in the contents{isFinalized ? ' · finalised' : ''}. Every page beside you is that article’s own editor preview, and the PDF prints these very pages — one article at a time, the same way each article prints on its own.</p>
              : <p className="field-hint">Setting the issue…</p>}
            <div className="card-actions">
              <button type="button" disabled={busy || !ready} onClick={rebuildContents}>Rebuild contents page</button>
              <button type="button" className={issueStale ? 'primary' : ''} disabled={busy || !ready} onClick={recompile}>Recompile whole issue</button>
            </div>
            <p className="field-hint">Nothing recompiles while you type. Rebuild the contents page after wording, colour or crop changes; recompile the whole issue after reordering, renumbering, or editing the articles themselves.</p>
          </section>
          <section className="card">
            <h2>Finalise &amp; export</h2>
            <p className="field-hint">Finalising writes each article’s starting page number back into the saved document, so a single-article export carries the same folio as the issue.</p>
            {contentsOverflow && ready && <p className="inline-alert" role="alert">The contents text does not fit its two pages. Shorten the heading or introduction, drop a subtitle, or uncheck some entries.</p>}
          </section>
        </div>}
      </aside>

      <section className="stage">
        <div className="stage-bar">
          <div className="stage-title">
            <strong>Compiled preview</strong>
            {ready && <span>{physicalPages} {physicalPages === 1 ? 'page' : 'pages'}</span>}
          </div>
          <div className="stage-tools">
            {proofStale && <button type="button" className="stale-pill" disabled={busy} onClick={rebuildContents}>{issueStale ? 'Arrangement changed — recompile' : 'Edits not shown yet — rebuild'}</button>}
            <div className="zoom">
              <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(Math.max(0.12, Math.round((scale - 0.05) * 100) / 100))}>−</button>
              <button type="button" className={zoom === 'fit' ? 'is-active' : ''} onClick={() => setZoom('fit')}>Fit</button>
              <span>{Math.round(scale * 100)}%</span>
              <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(Math.min(1, Math.round((scale + 0.05) * 100) / 100))}>+</button>
            </div>
          </div>
        </div>
        <div className="stage-scroll" ref={stageRef}>
          {ready
            ? <IssueProof plan={proofPlan} entries={entries} documents={compiled!.numbered} magazineName={data.project.name} design={proofDesign} contentsStart={contentsStart} scale={scale} pagesRef={pagesRef} onOverflow={setContentsOverflow} />
            : <div className="stage-progress" role="status">
                <Wordmark className="stage-mark" />
                <h3>{renderError ? 'An article needs attention' : progress.pass > 1 ? 'Numbering the pages' : 'Setting the issue'}</h3>
                <p>{renderError || `${progress.pass > 1 ? 'Printing folios onto' : 'Measuring'} ${progress.name || 'article layouts'} with the same engine the article editor uses.`}</p>
                <progress value={progress.completed} max={Math.max(1, progress.total)} />
                <p className="stage-progress-count">Pass {progress.pass} of {progress.passes} · {progress.completed} of {progress.total} articles</p>
                {renderError && <button className="primary" onClick={recompile}>Try again</button>}
              </div>}
        </div>
      </section>
    </div>

    <footer className="studio-actions">
      <div><strong>{isFinalized ? 'Issue finalised' : proofStale && ready ? 'Preview is out of date' : 'Ready when you are'}</strong><span>{busy ? 'Working… please wait.' : proofStale && ready ? 'Rebuild the preview so the export matches what you have set.' : 'Finalising updates page numbers in the project’s saved articles.'}</span></div>
      <div>
        <button disabled={blocked} onClick={() => void exportIssue()}>{busy ? 'Please wait…' : 'Export issue PDF'}</button>
        <button className="primary" disabled={blocked || isFinalized || save.status === 'error' || items.length === 0} onClick={() => void finalize()}>{isFinalized ? 'Finalised ✓' : busy ? 'Working…' : 'Finalise issue & page numbers'}</button>
      </div>
    </footer>

    {!ready && !renderError && <IssueCompiler key={compileToken} sources={sources} plan={plan} items={items} onComplete={onCompiled} onError={onCompileError} onProgress={onProgress} />}
  </main>;
}
