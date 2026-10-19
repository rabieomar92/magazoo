import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useDoc } from '../store/useDoc';
import { openProject, saveProject, saveProjectAs, useProjectFile, useFileActivity } from '../store/projectFiles';
import { useSaveStatus, type SaveState } from '../store/saveStatus';
import { exportPreviewPdf } from '../lib/pdfExport';
import { PDF_PAGE_SIZES, type PdfPageSize } from '../lib/pdfPageSize';
import { usePdfPageSize } from '../store/pdfPreferences';
import { Wordmark } from '../components/Wordmark';
import { MagazooLoader } from '../components/MagazooLoader';
import { registerPublicationPrint } from '../lib/nativePrint';
import { BusyIndicator } from '../components/BusyIndicator';
import {documentBleed} from '../lib/documentBleed';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Ready',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Failed to save',
};

const undo = () => useDoc.temporal.getState().undo();
const redo = () => useDoc.temporal.getState().redo();

export function Toolbar({ onPreviewToolsHost, onToggleSidebar, sidebarCollapsed = false }: {
  onPreviewToolsHost: (host: HTMLDivElement | null) => void;
  onToggleSidebar?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  sidebarCollapsed?: boolean;
}) {
  const canUndo = useStore(useDoc.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDoc.temporal, (s) => s.futureStates.length > 0);
  const saveState = useSaveStatus((s) => s.status);
  const projectStatusValue=useProjectFile(s=>s.status);
  const projectMessage=useProjectFile(s=>s.message);
  const project={status:projectStatusValue,message:projectMessage};
  const projectStatus = { draft: 'Draft', pending: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', error: 'Save failed', conflict: 'Save conflict' }[project.status];
  const title = useDoc((s) => s.doc.meta.title);
  const bleedMm=useDoc(s=>documentBleed(s.doc.design.bleedMm));
  const cropMarks=useDoc(s=>s.doc.design.cropMarks===true);
  const [exporting, setExporting] = useState(false);
  const opening=useFileActivity(state=>state.opening);
  const [pdfSize, setPdfSize] = usePdfPageSize();

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      if (document.querySelector('.pages > .fm-page')) {
        // Front-matter page count is measured after fonts settle. Let that
        // render commit before the exporter collects the visible sheets.
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }
      if (document.querySelector('.pages > .page[data-layout-overflow="true"]')) {
        throw new Error('One or more blocks exceed the printable frame. Check the red-outlined page and resolve its layout warning before exporting.');
      }
      await exportPreviewPdf(title, undefined, pdfSize,bleedMm,cropMarks);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert(error instanceof Error ? error.message : 'Could not prepare the PDF.');
    } finally {
      setExporting(false);
    }
  };

  const preparedExport=useRef(exportPdf);
  useLayoutEffect(()=>{preparedExport.current=exportPdf;});
  useEffect(() => registerPublicationPrint({source:()=>document.querySelector<HTMLElement>('.pages'),size:pdfSize,bleedMm,cropMarks,shortcut:()=>void preparedExport.current()}),[pdfSize,bleedMm,cropMarks]);

  // Keyboard: ⌘/Ctrl+Z undo, +Shift redo (or ⌘Y), ⌘S Save As.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      } else if (k === 's') {
        e.preventDefault();
        void (e.shiftKey ? saveProjectAs() : saveProject());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="toolbar">
      <div className="toolbar-identity" title={project.message}>
        {onToggleSidebar && <button type="button" className="tool-btn sidebar-toggle" onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} aria-controls="editor-panel"
          title={sidebarCollapsed ? 'Show editing controls' : 'Hide editing controls'}>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2.5" y="3" width="15" height="14" rx="2"/><path d="M8 3v14M4.5 6h1.5M4.5 9h1.5"/></svg>
        </button>}
        <Wordmark className="toolbar-brand" />
        <span className={`project-save-status${project.status==='error'||project.status==='conflict' ? ' is-error':''}`} role="status" aria-label={project.message}>{project.status==='saving'?<BusyIndicator label="Saving…"/>:projectStatus}</span>
        {saveState === 'error' && <span className="toolbar-save-error">Autosave failed</span>}
      </div>
      <span className="visually-hidden" role="status" aria-live="polite">
        Autosave: {SAVE_LABEL[saveState]}
      </span>
      <div
        ref={onPreviewToolsHost}
        id="toolbar-preview-tools"
        className="toolbar-preview-tools"
        aria-label="Preview tools"
      />
      <div className="toolbar-actions">
        <div className="toolbar-group toolbar-group--history" role="group" aria-label="Edit history">
          <button
            className="tool-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            <span className="tool-btn-icon" aria-hidden="true">↶</span>
            <span className="tool-btn-label">Undo</span>
          </button>
          <button
            className="tool-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            <span className="tool-btn-icon" aria-hidden="true">↷</span>
            <span className="tool-btn-label">Redo</span>
          </button>
        </div>
        <div className="toolbar-group toolbar-group--files" role="group" aria-label="Project files">
          <button
            className="tool-btn"
            onClick={() => void openProject()}
            disabled={opening}
            title="Open a Magazoo! project"
            aria-label="Open a Magazoo! project"
          >
            <span className="tool-btn-icon" aria-hidden="true">↗</span>
            <span className="tool-btn-label">{opening?<BusyIndicator label="Opening…"/>:'Open'}</span>
          </button>
          <button className="tool-btn" onClick={() => void saveProject()} title="Save (Ctrl/⌘S)" aria-label="Save">Save</button>
          <button
            className="tool-btn"
            onClick={() => void saveProjectAs()}
            title="Save As… (Ctrl/⌘Shift+S)"
            aria-label="Save As"
          >
            <span className="tool-btn-icon" aria-hidden="true">↓</span>
            <span className="tool-btn-label">Save As…</span>
          </button>
        </div>
        <div className="toolbar-group toolbar-group--export" role="group" aria-label="PDF output">
          <select className="tool-btn select-control pdf-size-select" aria-label="PDF page size" value={pdfSize} disabled={exporting}
            title={`Canvas and output: ${PDF_PAGE_SIZES[pdfSize].width} × ${PDF_PAGE_SIZES[pdfSize].height} mm at 100%. This browser remembers your choice; your article JSON is unchanged.`}
            onChange={event => setPdfSize(event.target.value as PdfPageSize)}>
            {Object.entries(PDF_PAGE_SIZES).map(([key, size]) => <option key={key} value={key}>{size.label} · {size.width} × {size.height} mm</option>)}
          </select>
          <button
            className="tool-btn tool-btn--primary"
            onClick={() => void exportPdf()}
            disabled={exporting}
            aria-busy={exporting}
            title={`Export ${PDF_PAGE_SIZES[pdfSize].label} pages to PDF — choose Save as PDF, Default margins (the publication sets zero), 100% scale, and background graphics`}
            aria-label={exporting ? 'Preparing PDF' : 'Export PDF'}
          >
            {exporting
              ? <MagazooLoader variant="inline" label="Preparing…" />
              : <><span className="tool-btn-icon tool-btn-icon--pdf" aria-hidden="true" /><span className="tool-btn-label">Export PDF</span></>}
          </button>
        </div>
      </div>
    </header>
  );
}
