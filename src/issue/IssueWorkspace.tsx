import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { migrate } from '../schema/document';
import {withProjectIssueLabel} from '../lib/projectIssueLabel';
import { exportIssuePdf, issuePageGroups, waitForPreviewResources } from '../lib/pdfExport';
import { PDF_PAGE_SIZES, type PdfPageSize } from '../lib/pdfPageSize';
import { pageDimensions, withPageFormat } from '../lib/pageFormat';
import { usePdfPageSize, usePdfPreferences } from '../store/pdfPreferences';
import { issueApi } from './api';
import { contentsDesignOf, contentsEntries, defaultIssuePlan, reconcileIssuePlan, CONTENTS_ID, type ContentsDensity, type ContentsDesign, type ContentsEntryStyle, type ContentsPictures, type IssueItem, type IssuePlan, type IssueResponse } from './model';
import { IssueCompiler, reconcileCompiledProof, type CompiledIssue, type CompileProgress } from './IssueCompiler';
import { IssueProof } from './IssueProof';
import { ContentsEntryCard } from './ContentsEntryCards';
import { IssueOrder } from './IssueOrder';
import { useIssueAutosave } from './useIssueAutosave';
import './issue.css';
import { Wordmark } from '../components/Wordmark';
import { MagazooLoader } from '../components/MagazooLoader';
import { registerPublicationPrint } from '../lib/nativePrint';
import { restoreArrangement } from './arrangementBackup';
import { BusyIndicator } from '../components/BusyIndicator';
import { IssuePdfImport } from './IssuePdfImport';
import { withExternalPdfItems } from './externalPdfModel';
import { releaseIssuePdf } from './externalPdf';
import type { ExternalIssuePdf } from './model';
import { IssuePrintBrief } from './IssuePrintBrief';
import {CanvasNumericAdjust} from '../paper/CanvasNumericAdjust';

/** What the compiled sheets are built from, and the only thing that can put
 * the proof out of date. Everything else an editor can change — wording,
 * colours, crops, which entries are listed — the contents spread re-lays on
 * its own, live, without the issue being set again. */
const numberingKey = (plan: IssuePlan) => JSON.stringify([plan.order, plan.startNumber, plan.countCovers]);

export default function IssueWorkspace({ projectId, csrf, onClose }: { projectId: string; csrf: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState<IssueResponse | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null); setError('');
    void issueApi<IssueResponse>(projectId, csrf, '', 'GET', undefined, controller.signal).then(data => {
      const items = data.items.map(item => ({ ...item, doc: withProjectIssueLabel(migrate(item.doc),data.project.name) }));
      const nativeFormat=items[0]?.doc.design.pageFormat;
      if(nativeFormat&&items.every(item=>item.doc.design.pageFormat===nativeFormat))usePdfPreferences.getState().setSize(nativeFormat);
      setLoaded({ ...data, items });
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to open this project.'); });
    return () => controller.abort();
  }, [projectId, csrf, reload]);
  if (!loaded) return <main className="studio is-booting">
    <header className="studio-bar"><div className="studio-bar-lead"><Wordmark className="studio-brand" /><span className="studio-chip">Issue studio</span></div><button onClick={onClose}>Back to library</button></header>
    <div className="studio-boot">{error
      ? <><h1>Could not open this issue</h1><p role="alert">{error}</p><button className="primary" onClick={() => setReload(value => value + 1)}>Try again</button></>
      : <MagazooLoader label="Opening your project" detail="Loading its saved articles and issue arrangement…" />}</div>
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
  const [articles, setItems] = useState<IssueItem[]>(data.items);
  const [plan, setPlan] = useState<IssuePlan>(() => data.plan ? reconcileIssuePlan(data.plan, withExternalPdfItems(data.items, data.plan.externalPdfs)) : defaultIssuePlan(data.items));
  const items = useMemo(()=>withExternalPdfItems(articles,plan.externalPdfs),[articles,plan.externalPdfs]);
  const pdfResources = useRef(plan.externalPdfs);
  useEffect(()=>{pdfResources.current=plan.externalPdfs;},[plan.externalPdfs]);
  useEffect(()=>()=>pdfResources.current?.forEach(releaseIssuePdf),[]);
  /** The arrangement the sheets on screen were built from. Editing is free;
   * re-setting the issue is deliberate. */

  const [compiled, setCompiled] = useState<CompiledIssue | null>(null);
  const [compileToken, setCompileToken] = useState(0);
  const [renderError, setRenderError] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<CompileProgress>({ completed: 0, total: data.items.length, name: '', pass: 1, passes: 2 });
  const [busy, setBusy] = useState(false);
  const [pdfSize, setPdfSize] = usePdfPageSize();
  const compositionFormat = pdfSize;
  const [compiledFormat, setCompiledFormat] = useState<typeof compositionFormat | null>(null);
  const [contentsOverflow, setContentsOverflow] = useState(true);
  const [finalizedPlan, setFinalizedPlan] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('arrange');
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [canvasView, setCanvasView] = useState<'proof' | 'arrange'>('proof');
  const [selectedEntry, setSelectedEntry] = useState('');
  const [fitScale, setFitScale] = useState(0.4);
  const [proofVersion, setProofVersion] = useState(0);
  const [proofVerified,setProofVerified]=useState(false);
  const proofPasses=useRef(0);
  const restoredFinalization = useRef(false);
  const pagesRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const save = useIssueAutosave(data.project.id, csrf, plan, data.version, data.plan);

  // A new array identity is what tells the compiler to set the issue again.
  const sources = useMemo(() => { void compileToken; return items.map(({ id, name, doc, externalPdf }) => ({ id, name, doc: withPageFormat(doc, compositionFormat), externalPdf })); }, [items, compileToken, compositionFormat]);
  const ready = !!compiled && compiledFormat === compositionFormat;
  const assignments = useMemo(() => ready ? compiled!.assignments : [], [compiled, ready]);
  // Keep old design data readable, but the studio now offers one dependable
  // contents composition instead of three competing sets of controls.
  const contentsDesign = useMemo<ContentsDesign>(() => ({ ...contentsDesignOf(plan), layout: 'mosaic' }), [plan]);
  /**
   * What the contents spread on screen is drawn from.
   *
   * Live for everything the contents owns — wording, colours, crops, which
   * entries are listed — because none of that moves a page number, so the
   * spread can simply re-lay itself as the editor types. The arrangement
   * itself (reading order, first page, whether covers count) is taken from
   * the compiled issue instead: changing those renumbers the sheets, and a
   * contents page numbered against an arrangement the sheets were not built
   * from is exactly the error a proof exists to catch.
   */
  const proofPlan = useMemo<IssuePlan | null>(() => (ready ? {
    ...compiled!.plan,
    contentsTitle: plan.contentsTitle,
    contentsSubtitle: plan.contentsSubtitle,
    direction: plan.direction,
    contentsExcluded: plan.contentsExcluded,
    contentsDesign: plan.contentsDesign,
    contentsStyle: plan.contentsStyle,
  } : null), [compiled, plan, ready]);
  const proofDesign = contentsDesign;
  const entries = useMemo(() => {
    if (!compiled || !proofPlan) return [];
    try { return contentsEntries(proofPlan, items, compiled.assignments); } catch { return []; }
  }, [compiled, proofPlan, items]);
  const contentsItems = useMemo(() => plan.order
    .filter(id => id !== CONTENTS_ID && !plan.contentsExcluded.includes(id))
    .map(id => items.find(item => item.id === id))
    .filter((item): item is IssueItem => !!item), [plan.order, plan.contentsExcluded, items]);
  const physicalPages = assignments.reduce((total, row) => total + row.pageCount, 0);
  const contentsStart = assignments.find(row => row.id === CONTENTS_ID)?.startNumber ?? plan.startNumber;
  const finalizationKey = JSON.stringify([plan, compositionFormat]);
  const isFinalized = ready && finalizedPlan === finalizationKey;
  // Only the arrangement can go stale now; everything else is live.
  const proofStale = ready && numberingKey(compiled!.plan) !== numberingKey(plan);

  useEffect(() => {
    if (!ready || compositionFormat !== 'a4' || restoredFinalization.current) return;
    restoredFinalization.current = true;
    if (!data.sourcesChanged && data.finalized && data.plan && data.finalized.documents.every(saved => assignments.some(row => row.id === saved.id && row.pageCount === saved.pageCount && row.startNumber === saved.startNumber))) setFinalizedPlan(JSON.stringify([data.plan, compositionFormat]));
  }, [ready, data, assignments, compositionFormat]);

  // Fit a whole sheet in the stage — both directions, the way a proofing view
  // fits a page rather than only its width. Never above 100%: a preview that
  // magnified the paper would invite judging type sizes that are not real.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const dimensions = pageDimensions({ pageFormat: compositionFormat });
    const pageWidth = dimensions.width * 96 / 25.4;
    const pageHeight = dimensions.height * 96 / 25.4;
    const measure = () => setFitScale(Math.min(1, Math.max(0.12,
      Math.min((stage.clientWidth - 44) / pageWidth, (stage.clientHeight - 44) / pageHeight))));
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(stage);
    return () => observer?.disconnect();
  }, [compositionFormat]);
  const scale = zoom === 'fit' ? fitScale : zoom;

  const onCompiled = useCallback((result: CompiledIssue) => {
    setProofVerified(false);proofPasses.current=0;
    setCompiled(result);
    setCompiledFormat(compositionFormat);
    setRenderError('');
    setProofVersion(value => value + 1);
  }, [compositionFormat]);
  const onProofCounts=useCallback((counts:Record<string,number>)=>{
    if(!compiled)return;
    try {
      const next=reconcileCompiledProof(compiled,counts);
      if(next===compiled){setProofVerified(true);return;}
      if(++proofPasses.current>4)throw new Error('The assembled issue keeps changing page counts. Review the page layouts before exporting.');
      setProofVerified(false);setCompiled(next);
    }catch(failure){setError(failure instanceof Error?failure.message:'Could not verify the issue proof.');setProofVerified(false);}
  },[compiled]);
  useEffect(() => {
    setRenderError('');
    setNotice('');
    setContentsOverflow(true);
    setProgress({ completed: 0, total: items.length, name: '', pass: 1, passes: 2 });
  }, [compositionFormat, items.length]);
  // The crop control measures the real slot on the compiled sheet, so it has
  // to re-read after the spread has settled from an edit.
  useEffect(() => {
    const timer = window.setTimeout(() => setProofVersion(value => value + 1), 420);
    return () => window.clearTimeout(timer);
  }, [plan]);
  const onCompileError = useCallback((failure: Error) => setRenderError(failure.message), []);
  const onProgress = useCallback((value: CompileProgress) => setProgress(value), []);

  const updatePlan = (next: IssuePlan) => { setPlan(next); setNotice(''); };
  const importPdf = (pdf: ExternalIssuePdf) => {
    const externalPdfs=[...(plan.externalPdfs??[]),pdf];
    if(externalPdfs.reduce((sum,item)=>sum+item.src.length+item.thumbnail.length,0)>32*1024*1024)throw new Error('This arrangement has reached its 24 MB PDF limit. Use smaller files.');
    const order=[...plan.order];
    const back=order.findIndex(id=>items.find(item=>item.id===id)?.doc.templateId==='backcover-1');
    order.splice(back<0?order.length:back,0,pdf.id);
    updatePlan({...plan,externalPdfs,order,contentsExcluded:[...plan.contentsExcluded,pdf.id]});
    setCompiled(null);setRenderError('');setContentsOverflow(true);setCompileToken(value=>value+1);
    setNotice('PDF imported. Its pages stay together and count toward the whole issue. Imported pages print as fixed artwork at up to 300 dpi; the original PDF is retained in the arrangement.');
  };
  const removePdf = (id:string) => {
    const pdf=plan.externalPdfs?.find(item=>item.id===id);if(!pdf)return;
    const contentsStyle={...plan.contentsStyle};delete contentsStyle[id];
    updatePlan({...plan,order:plan.order.filter(value=>value!==id),externalPdfs:plan.externalPdfs?.filter(item=>item.id!==id),contentsExcluded:plan.contentsExcluded.filter(value=>value!==id),contentsStyle});
    setCompiled(null);setRenderError('');setContentsOverflow(true);setCompileToken(value=>value+1);
    releaseIssuePdf(pdf);
  };
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
    setContentsOverflow(true);
    setProgress({ completed: 0, total: items.length, name: '', pass: 1, passes: 2 });
    setCompileToken(value => value + 1);
  }, [items.length]);

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
    if (!ready || !proofVerified || contentsOverflow || proofStale) throw new Error('Wait for the assembled issue proof to settle before finalising.');
    const version = await save.flush();
    const documents = assignments.filter(row => row.id !== CONTENTS_ID && !items.find(item=>item.id===row.id)?.externalPdf).map(row => ({ id: row.id, version: items.find(item => item.id === row.id)!.version, startNumber: row.startNumber, pageCount: row.pageCount }));
    const result = await issueApi<{ version: number; items: { id: string; version: number }[] }>(data.project.id, csrf, '/finalize', 'POST', { version, plan, documents });
    save.acceptFinalizedVersion(result.version);
    setItems(previous => previous.map(item => ({ ...item, version: result.items.find(updated => updated.id === item.id)?.version ?? item.version })));
    setFinalizedPlan(finalizationKey);
    setNotice('Issue finalised. Starting page numbers are saved to every article. Your two-page contents spread is ready.');
  });
  const exportIssue = () => execute(async () => {
    if (!ready || !proofVerified || proofStale || contentsOverflow) throw new Error('Wait for the assembled issue proof to finish compiling before exporting.');
    if (canvasView === 'arrange') {
      setCanvasView('proof');
      await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    }
    const sheetCount = (root: HTMLElement) => issuePageGroups(root).reduce((total, group) => total + group.sheets.length, 0);
    const root = pagesRef.current;
    if (!root) throw new Error('Open the page proof before exporting.');
    // Font/image readiness and the pagination quiet period matter, not an
    // arbitrary ten seconds from clicking Export. Check counts only afterwards.
    await waitForPreviewResources(root);
    const actual = sheetCount(root);
    if (actual !== physicalPages) throw new Error(`The proof has ${actual} pages, but numbering was compiled for ${physicalPages}. Recompile the whole issue before exporting so the printed page numbers stay correct.`);
    await exportIssuePdf(data.project.name, root, pdfSize,plan.printSettings?.bleedMm??0);
  });

  const blocked = busy || !ready || !proofVerified || contentsOverflow || proofStale;
  const printState=useRef({blocked,exportIssue});
  useLayoutEffect(()=>{printState.current={blocked,exportIssue};});
  useEffect(() => registerPublicationPrint({source:()=>printState.current.blocked?null:pagesRef.current,size:pdfSize,issue:true,bleedMm:plan.printSettings?.bleedMm??0,shortcut:()=>void printState.current.exportIssue()}),[pdfSize,plan.printSettings?.bleedMm]);
  return <main className="studio" aria-busy={busy}>
    <header className="studio-bar">
      <div className="studio-bar-lead">
        <Wordmark className="studio-brand" />
        <span className="studio-chip">Issue studio</span>
        <span className="studio-project" dir="auto">{data.project.name}</span>
      </div>
      <div className="studio-bar-end">
        <span className={`save-pill is-${save.status}`} role="status">{save.status === 'saved' ? 'Saved' : save.status === 'saving' ? <BusyIndicator label="Saving…"/> : save.status === 'pending' ? 'Unsaved changes' : 'Not saved'}</span>
        <button disabled={busy} onClick={() => void execute(async () => { await save.flush(); onClose(); })}>Back to library</button>
      </div>
    </header>

    {(error || save.error) && <div className="banner is-error" role="alert"><span>{error || save.error}</span><button disabled={busy} onClick={() => void execute(() => save.flush().then(() => {}))}>Retry save</button><button disabled={busy} onClick={reloadArticles}>Reload articles</button></div>}
    {data.sourcesChanged && !isFinalized && <div className="banner">Some articles changed since the last finalisation. Recompile to pick up the new page counts, then finalise again.</div>}
    {notice && <div className="banner is-success" role="status">{notice}</div>}

    <div className="studio-shell">
      <aside className="inspector">
        <div className="inspector-metrics">
          <div><strong>{items.length}</strong><span>documents</span></div>
          <div><strong>{ready ? physicalPages : '—'}</strong><span>pages</span></div>
          <div><strong>{ready ? entries.length : '—'}</strong><span>listed</span></div>
        </div>
        <nav className="inspector-tabs" role="tablist" aria-label="Issue settings">
          {TABS.map(entry => <button key={entry.id} type="button" role="tab" id={`tab-${entry.id}`} aria-selected={tab === entry.id} aria-controls={`panel-${entry.id}`} className={tab === entry.id ? 'is-active' : ''} onClick={() => setTab(entry.id)}>{entry.label}</button>)}
        </nav>

        {tab === 'arrange' && <div className="panel" role="tabpanel" id="panel-arrange" aria-labelledby="tab-arrange">
          <section className="card">
            <div className="card-head"><h2>Reading order</h2><button disabled={busy || save.status !== 'saved'} onClick={onReload}>Refresh articles</button></div>
            <IssuePdfImport disabled={busy} onImport={importPdf} />
            <IssueOrder plan={plan} items={items} assignments={assignments} disabled={busy} onChange={updatePlan} onRemovePdf={removePdf} />
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
            <label className="field">Reading direction<select value={plan.direction} disabled={busy} onChange={event => updatePlan({ ...plan, direction: event.target.value as 'ltr' | 'rtl' })}><option value="ltr">Left to right</option><option value="rtl">Right to left (Arabic)</option></select></label>
          </section>
          <section className="card">
            <div className="card-head"><h2>Design</h2><button type="button" disabled={busy} onClick={() => updatePlan({ ...plan, contentsDesign: undefined })}>Reset</button></div>
            <div className="field-grid">
              <p className="field-hint">Mosaic · tiled cards</p>
              <label className="field">Density<select value={contentsDesign.density} disabled={busy} onChange={event => updateDesign({ density: event.target.value as ContentsDensity })}><option value="auto">Auto (fills page)</option><option value="airy">Airy</option><option value="normal">Normal</option><option value="dense">Dense</option><option value="packed">Packed</option></select></label>
              <label className="field">Headline font<select value={contentsDesign.titleFont} disabled={busy} onChange={event => updateDesign({ titleFont: event.target.value as 'serif' | 'sans' })}><option value="serif">Serif · Playfair</option><option value="sans">Sans · Avenir Next</option></select></label>
              <label className="field swatch">Accent<input type="color" value={contentsDesign.accent} disabled={busy} onChange={event => updateDesign({ accent: event.target.value })} /></label>
              <label className="field swatch">Page colour<input type="color" value={contentsDesign.pageColor} disabled={busy} onChange={event => updateDesign({ pageColor: event.target.value })} /></label>
              <label className="field swatch">Text colour<input type="color" value={contentsDesign.textColor} disabled={busy} onChange={event => updateDesign({ textColor: event.target.value })} /></label>
              <label className="field swatch">Top bar colour<input type="color" value={contentsDesign.topBarColor} disabled={busy} onChange={event => updateDesign({ topBarColor: event.target.value })} /></label>
              <label className="field swatch">Headings<input type="color" value={contentsDesign.headingColor} disabled={busy} onChange={event => updateDesign({ headingColor: event.target.value })} /></label>
              {contentsDesign.layout === 'mosaic' && <label className="field">Pictures<select value={contentsDesign.pictures} disabled={busy} onChange={event => updateDesign({ pictures: event.target.value as ContentsPictures })}><option value="auto">Automatic — as many as fit</option><option value="all">On every entry that has one</option><option value="none">Text only</option></select></label>}
            </div>
            <label className="field range">Text size <b>{Math.round(contentsDesign.textScale * 100)}%</b><input type="range" min={0.85} max={1.15} step={0.01} value={contentsDesign.textScale} disabled={busy} onChange={event => updateDesign({ textScale: event.target.valueAsNumber })} /></label>
            <label className="field range">Character spacing <b>{contentsDesign.tracking >= 0 ? '+' : ''}{contentsDesign.tracking.toFixed(3)}em</b><input type="range" min={-0.02} max={0.04} step={0.005} value={contentsDesign.tracking} disabled={busy} onChange={event => updateDesign({ tracking: event.target.valueAsNumber })} /></label>
            <label className="field range">Gaps <b>{Math.round(contentsDesign.gapScale * 100)}%</b><input type="range" min={0.7} max={1.3} step={0.05} value={contentsDesign.gapScale} disabled={busy} onChange={event => updateDesign({ gapScale: event.target.valueAsNumber })} /></label>
            <div className="switch-set">
              {contentsDesign.layout !== 'mosaic' && <label className="switch"><input type="checkbox" checked={contentsDesign.showHeroes} disabled={busy} onChange={event => updateDesign({ showHeroes: event.target.checked })} /><span>Show pictures</span></label>}
              <label className="switch"><input type="checkbox" checked={contentsDesign.pageLabels} disabled={busy} onChange={event => updateDesign({ pageLabels: event.target.checked })} /><span>Page chip on pictures</span></label>
              <label className="switch"><input type="checkbox" checked={contentsDesign.rules} disabled={busy} onChange={event => updateDesign({ rules: event.target.checked })} /><span>Dividing rules</span></label>
              <label className="switch"><input type="checkbox" checked={contentsDesign.paddedNumbers} disabled={busy} onChange={event => updateDesign({ paddedNumbers: event.target.checked })} /><span>Zero-padded numbers</span></label>
            </div>
            {contentsDesign.layout === 'mosaic' && <div className="card-actions">
              <button type="button" disabled={busy} onClick={() => updateDesign({ mosaicSalt: (contentsDesign.mosaicSalt + 1) % 10000 })}>Shuffle the tiles</button>
            </div>}
            <p className="field-hint">{contentsDesign.layout === 'mosaic'
              ? 'Cards follow page order where possible. Later text-only cards can fill gaps beside taller picture cards; their printed page numbers stay unchanged. Pictures are fitted to the available room. Shuffling changes the picture choices.'
              : 'Density decides how much each page tries to hold before shrinking; on Auto it steps down only as far as it must to still fit two pages. The three sliders apply on top of whichever density ends up showing.'}</p>
          </section>
        </div>}

        {tab === 'entries' && <div className="panel" role="tabpanel" id="panel-entries" aria-labelledby="tab-entries">
          <section className="card">
            <h2>Contents entries</h2>
            <p className="field-hint">Each line of the contents page, independent of the article it came from. Open one to reword it, drop or reframe its picture, or move it to another section.</p>
            <div className="entry-list">
              {contentsItems.length === 0 && <p className="field-hint">No articles are listed in the contents spread yet.</p>}
              {contentsItems.length > 0 && <label className="field">Edit contents entry<select value={contentsItems.some(item => item.id === selectedEntry) ? selectedEntry : contentsItems[0].id} disabled={busy} onChange={event => setSelectedEntry(event.target.value)}>{contentsItems.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.doc.meta.title || item.name}</option>)}</select></label>}
              {contentsItems.filter(item => item.id === (contentsItems.some(entry => entry.id === selectedEntry) ? selectedEntry : contentsItems[0]?.id)).map(item => <ContentsEntryCard
                key={item.id} item={item} index={contentsItems.indexOf(item)} design={contentsDesign} busy={busy} proofVersion={proofVersion}
                style={plan.contentsStyle?.[item.id] ?? {}}
                onChange={patch => updateEntryStyle(item.id, patch)}
                onReset={() => resetEntryStyle(item.id)}
              />)}
            </div>
          </section>
        </div>}

        {tab === 'output' && <div className="panel" role="tabpanel" id="panel-output" aria-labelledby="tab-output">
          <section className="card">
            <h2>Arrangement backup</h2>
            <button type="button" disabled={busy} onClick={()=>{
              const file=new Blob([JSON.stringify({plan,items:articles.map(({id,name})=>({id,name}))},null,2)],{type:'application/json'});
              const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download='magazoo-arrangement.json';link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
            }}>Download arrangement &amp; imported PDFs</button>
            <p className="field-hint">Restore reading order, contents wording, design and numbering after uploading the same article files. This does not replace article content.</p>
            <label className="field">Restore arrangement<input type="file" accept=".json,application/json" disabled={busy} onChange={async event=>{
              const input=event.currentTarget,file=input.files?.[0];if(!file)return;
              try { const restored=restoreArrangement(JSON.parse(await file.text()),items);updatePlan(restored);setNotice('Arrangement restored. Recompile to update page numbers.');setError(''); }
              catch(failure){setError(failure instanceof Error?failure.message:'Could not restore arrangement.');}
              finally{input.value='';}
            }}/></label>
          </section>
          <section className="card">
            <h2>Compile</h2>
            {ready
              ? <p className="field-hint">{physicalPages} physical pages across {items.length} {items.length === 1 ? 'article' : 'articles'}, {entries.length} listed in the contents{isFinalized ? ' · finalised' : ''}. Every page beside you is that article’s own editor preview, and the PDF prints these very pages — one article at a time, the same way each article prints on its own.</p>
              : <p className="field-hint">Setting the issue…</p>}
            <div className="card-actions">
              <button type="button" className={proofStale ? 'primary' : ''} disabled={busy || !ready} onClick={recompile}>Recompile whole issue</button>
            </div>
            <p className="field-hint">The contents spread re-lays itself as you type — wording, colours and crops need nothing. Recompiling is only for the arrangement itself: reordering, renumbering, or editing the articles.</p>
          </section>
          <section className="card">
            <h2>Finalise &amp; export</h2>
            <IssuePrintBrief title={data.project.name} plan={plan} items={items} assignments={assignments} size={pdfSize} disabled={busy||!ready||!proofVerified||proofStale} onChange={updatePlan}/>
            <label className="field">PDF page size<select value={pdfSize} disabled={busy} onChange={event => setPdfSize(event.target.value as PdfPageSize)}>
              {Object.entries(PDF_PAGE_SIZES).map(([key, size]) => <option key={key} value={key}>{size.label} · {size.width} × {size.height} mm</option>)}
            </select></label>
            <label className="field">Bleed per edge (mm)<input type="number" min="0" max="10" step="0.5" value={plan.printSettings?.bleedMm??0} disabled={busy} onChange={event=>updatePlan({...plan,printSettings:{binding:'saddle-stitch',perfectMultiple:2,...plan.printSettings,bleedMm:Math.max(0,Math.min(10,Number(event.target.value)))}})}/></label>
            <p className="field-hint">Trim: {PDF_PAGE_SIZES[pdfSize].width} × {PDF_PAGE_SIZES[pdfSize].height} mm. Output with bleed: {PDF_PAGE_SIZES[pdfSize].width+2*(plan.printSettings?.bleedMm??0)} × {PDF_PAGE_SIZES[pdfSize].height+2*(plan.printSettings?.bleedMm??0)} mm. Set the amount requested by your printer, such as 3 or 5 mm; zero exports at trim size. Text remains at its original size and position. Background artwork extends into the extra area; no guide lines are printed.</p>
            <p className="field-hint">A4, ISO B5, JIS B5 and Magazine lay out every article, cover and contents page directly at the selected paper size. Changing size recompiles the issue and may change its page counts; saved article content stays untouched. Choose the browser’s Save as PDF, Default margins (the publication sets them to zero), 100% scale and Background graphics. A system PDF printer or physical printer may need a matching custom paper size.</p>
            <p className="field-hint">Finalising writes each article’s starting page number back into the saved document, so a single-article export carries the same folio as the issue.</p>
            {contentsOverflow && ready && <p className="inline-alert" role="alert">The contents text does not fit its two pages. Shorten the heading or introduction, drop a subtitle, or uncheck some entries.</p>}
          </section>
        </div>}
      </aside>

      <section className="stage">
        <div className="stage-bar">
          <div className="stage-title">
            <strong>Compiled preview</strong>
            {ready&&!proofVerified&&<BusyIndicator label="Verifying pages…"/>}
            {ready && <span>{physicalPages} {physicalPages === 1 ? 'page' : 'pages'}</span>}
          </div>
          <div className="stage-tools">
            <button type="button" className={canvasView === 'arrange' ? 'is-active' : ''} disabled={busy} onClick={() => setCanvasView(value => value === 'arrange' ? 'proof' : 'arrange')}>{canvasView === 'arrange' ? 'View pages' : 'Arrange on canvas'}</button>
            {proofStale && <button type="button" className="stale-pill" disabled={busy} onClick={recompile}>Arrangement changed — recompile</button>}
            <div className="zoom">
              <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(Math.max(0.12, Math.round((scale - 0.05) * 100) / 100))}>−</button>
              <button type="button" className={zoom === 'fit' ? 'is-active' : ''} onClick={() => setZoom('fit')}>Fit</button>
              <span>{Math.round(scale * 100)}%</span>
              <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(Math.min(1, Math.round((scale + 0.05) * 100) / 100))}>+</button>
            </div>
          </div>
        </div>
        <div className="stage-scroll" ref={stageRef}>
          {canvasView === 'arrange' && <section className="issue-canvas-order" aria-label="Arrange articles on canvas">
            <div className="issue-arrange-heading"><h2>Arrange your issue</h2><div className="issue-arrange-actions"><IssuePrintBrief title={data.project.name} plan={plan} items={items} assignments={assignments} size={pdfSize} disabled={busy||!ready||!proofVerified||proofStale} onChange={updatePlan}/><IssuePdfImport disabled={busy} onImport={importPdf} /></div></div>
            <p>Drag an article to its new position. Its pages move together. Then recompile to refresh the page numbers.</p>
            <IssueOrder plan={plan} items={items} assignments={assignments} disabled={busy} onChange={updatePlan} onRemovePdf={removePdf} visual />
            {proofStale && <button type="button" className="primary" disabled={busy} onClick={() => { recompile(); setCanvasView('proof'); }}>Apply order &amp; recompile</button>}
          </section>}
          <div className={canvasView === 'arrange'?'issue-proof-offstage':undefined}>
          {ready
            ? <IssueProof plan={proofPlan!} entries={entries} documents={compiled!.numbered} magazineName={data.project.name} design={proofDesign} contentsStart={contentsStart} contentsSide={assignments.find(row => row.id === CONTENTS_ID)?.mastheadSide} pageSize={pdfSize} scale={scale} pagesRef={pagesRef} onOverflow={setContentsOverflow} onPageCounts={onProofCounts} onPending={()=>setProofVerified(false)} onError={failure=>{setError(failure.message);setProofVerified(false);}} />
            : <div className="stage-progress">
                {renderError
                  ? <><Wordmark className="stage-mark" /><h3>An article needs attention</h3><p role="alert">{renderError}</p><button className="primary" onClick={recompile}>Try again</button></>
                  : <MagazooLoader
                      tone="dark"
                      label={progress.pass > 1 ? 'Numbering the pages' : 'Setting the issue'}
                      detail={`${progress.pass > 1 ? 'Printing folios onto' : 'Measuring'} ${progress.name || 'article layouts'} · Pass ${progress.pass} of ${progress.passes} · ${progress.completed} of ${progress.total} articles`}
                      value={progress.completed}
                      max={Math.max(1, progress.total)}
                    />}
              </div>}
          </div>
        </div>
      </section>
    </div>

    <footer className="studio-actions">
      <div><strong>{isFinalized ? 'Issue finalised' : proofStale && ready ? 'Arrangement changed' : 'Ready when you are'}</strong><span>{busy ? 'Working… please wait.' : proofStale && ready ? 'Recompile so the page numbers match the order you have set.' : 'Finalising updates page numbers in the project’s saved articles.'}</span></div>
      <div>
        <button disabled={blocked} onClick={() => void exportIssue()}>{busy ? 'Please wait…' : `Export ${pdfSize === 'magazine' ? '203 × 267 mm' : pdfSize.toUpperCase()} issue PDF`}</button>
        <button className="primary" disabled={blocked || isFinalized || save.status === 'error' || items.length === 0} onClick={() => void finalize()}>{isFinalized ? 'Finalised ✓' : busy ? 'Working…' : 'Finalise issue & page numbers'}</button>
      </div>
    </footer>

    {busy && <div className="studio-busy"><MagazooLoader variant="banner" label="Magazoo is working…" detail="Please keep this window open." /></div>}
    {!busy&&<CanvasNumericAdjust/>}

    {!ready && !renderError && <IssueCompiler key={`${compileToken}-${compositionFormat}`} sources={sources} plan={plan} items={items} onComplete={onCompiled} onError={onCompileError} onProgress={onProgress} />}
  </main>;
}
