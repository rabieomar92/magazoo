import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { useDoc } from '../store/useDoc';
import { openProject, saveProject, saveProjectAs, useProjectFile } from '../store/projectFiles';
import { useSaveStatus, type SaveState } from '../store/saveStatus';
import { exportPreviewPdf } from '../lib/pdfExport';
import { PDF_PAGE_SIZES, type PdfPageSize } from '../lib/pdfPageSize';
import { Wordmark } from '../components/Wordmark';
import { MagazooLoader } from '../components/MagazooLoader';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Ready',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Failed to save',
};

const undo = () => useDoc.temporal.getState().undo();
const redo = () => useDoc.temporal.getState().redo();

export function Toolbar({ onPreviewToolsHost }: { onPreviewToolsHost: (host: HTMLDivElement | null) => void }) {
  const canUndo = useStore(useDoc.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDoc.temporal, (s) => s.futureStates.length > 0);
  const saveState = useSaveStatus((s) => s.status);
  const projectStatusValue=useProjectFile(s=>s.status);
  const projectMessage=useProjectFile(s=>s.message);
  const project={status:projectStatusValue,message:projectMessage};
  const projectStatus = { draft: 'Draft', pending: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', error: 'Save failed', conflict: 'Save conflict' }[project.status];
  const title = useDoc((s) => s.doc.meta.title);
  const [exporting, setExporting] = useState(false);
  const [pdfSize, setPdfSize] = useState<PdfPageSize>('a4');

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
      await exportPreviewPdf(title, undefined, pdfSize);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert(error instanceof Error ? error.message : 'Could not prepare the PDF.');
    } finally {
      setExporting(false);
    }
  };

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
        <Wordmark className="toolbar-brand" />
        <span className={`project-save-status${project.status==='error'||project.status==='conflict' ? ' is-error':''}`} role="status" aria-label={project.message}>{projectStatus}</span>
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
        <div className="toolbar-group toolbar-group--history">
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
        <div className="toolbar-group toolbar-group--files">
          <button
            className="tool-btn"
            onClick={() => void openProject()}
            title="Open a Magazoo! project"
            aria-label="Open a Magazoo! project"
          >
            <span className="tool-btn-icon" aria-hidden="true">↗</span>
            <span className="tool-btn-label">Open</span>
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
          <select className="tool-btn pdf-size-select" aria-label="PDF page size" value={pdfSize} disabled={exporting}
            title="B5 fits the complete layout proportionally; no cropping or extra bleed."
            onChange={event => setPdfSize(event.target.value as PdfPageSize)}>
            {Object.entries(PDF_PAGE_SIZES).map(([key, size]) => <option key={key} value={key}>{size.label} · {size.width} × {size.height} mm</option>)}
          </select>
          <button
            className="tool-btn tool-btn--primary"
            onClick={() => void exportPdf()}
            disabled={exporting}
            aria-busy={exporting}
            title={`Export ${PDF_PAGE_SIZES[pdfSize].label} pages to PDF — use no print margins and 100% scale`}
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
