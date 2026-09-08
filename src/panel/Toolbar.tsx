import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { useDoc } from '../store/useDoc';
import { openProject, saveProject, saveProjectAs, useProjectFile } from '../store/projectFiles';
import { useSaveStatus, type SaveState } from '../store/saveStatus';
import { exportPreviewPdf } from '../lib/pdfExport';

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
  const project=useProjectFile();
  const title = useDoc((s) => s.doc.meta.title);
  const [exporting, setExporting] = useState(false);

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
        throw new Error('A front-matter heading or side note exceeds its frame. Shorten the text or reduce its size before exporting.');
      }
      await exportPreviewPdf(title);
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
        <span className="toolbar-brand" aria-label="Magazoo! editor">Magazoo!</span>
        <span className={`project-save-status${project.status==='error'||project.status==='conflict' ? ' is-error':''}`} role="status">{project.message}</span>
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
          <button
            className="tool-btn tool-btn--primary"
            onClick={() => void exportPdf()}
            disabled={exporting}
            aria-busy={exporting}
            title="Export clean A4 pages to PDF"
            aria-label={exporting ? 'Preparing PDF' : 'Export PDF'}
          >
            <span className="tool-btn-icon tool-btn-icon--pdf" aria-hidden="true" />
            <span className="tool-btn-label">{exporting ? 'Preparing…' : 'Export PDF'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
