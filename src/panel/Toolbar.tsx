import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { useDoc } from '../store/useDoc';
import { cleanOrphanedAssets, migrate } from '../schema/document';
import { useSaveStatus, type SaveState } from '../store/saveStatus';
import { exportPreviewPdf } from '../lib/pdfExport';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Failed to save',
};

function pickFile(onPick: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) onPick(f);
  };
  input.click();
}

const undo = () => useDoc.temporal.getState().undo();
const redo = () => useDoc.temporal.getState().redo();

interface WritableProjectFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface ProjectFileHandle {
  createWritable(): Promise<WritableProjectFile>;
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<ProjectFileHandle>;
};

async function saveAs() {
  const doc = cleanOrphanedAssets(useDoc.getState().doc);
  const name =
    (doc.meta.title.trim() || 'magazoo-project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'magazoo-project';
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });

  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker.call(window, {
        suggestedName: `${name}.json`,
        types: [
          {
            description: 'Magazoo! project',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Save As failed:', error);
      alert('Could not save the project. Please choose another location and try again.');
      return;
    }
  }

  alert(
    'This browser does not support choosing a save location. Open Magazoo! in a current Chromium-based browser to use Save As.',
  );
}

function open() {
  pickFile((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        useDoc.getState().load(migrate(JSON.parse(reader.result as string)));
      } catch {
        alert('Invalid file or unsupported version.');
      }
    };
    reader.readAsText(file);
  });
}

export function Toolbar({ onPreviewToolsHost }: { onPreviewToolsHost: (host: HTMLDivElement | null) => void }) {
  const canUndo = useStore(useDoc.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDoc.temporal, (s) => s.futureStates.length > 0);
  const saveState = useSaveStatus((s) => s.status);
  const title = useDoc((s) => s.doc.meta.title);
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
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
        void saveAs();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="toolbar">
      <span
        className={`save-status${saveState === 'error' ? ' save-status--error' : ''}${saveState === 'idle' ? ' is-idle' : ''}`}
        role="status"
        aria-live="polite"
      >
        <span className="save-status-dot" aria-hidden="true" />
        {saveState === 'idle' ? 'Ready' : SAVE_LABEL[saveState]}
      </span>
      <div
        ref={onPreviewToolsHost}
        id="toolbar-preview-tools"
        className="toolbar-preview-tools"
        aria-label="Preview tools"
      />
      <div className="toolbar-group">
        <button className="tool-btn" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
          ↶ Undo
        </button>
        <button className="tool-btn" onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)">
          ↷ Redo
        </button>
      </div>
      <div className="toolbar-group">
        <button className="tool-btn" onClick={open} title="Open a Magazoo! project">
          <span aria-hidden="true">↗</span> Open
        </button>
        <button className="tool-btn" onClick={() => void saveAs()} title="Save As… (⌘S)">
          <span aria-hidden="true">↓</span> Save As…
        </button>
        <button
          className="tool-btn tool-btn--primary"
          onClick={() => void exportPdf()}
          disabled={exporting}
          aria-busy={exporting}
          title="Export clean A4 pages to PDF"
        >
          <span aria-hidden="true">PDF</span> {exporting ? 'Preparing…' : 'Export PDF'}
        </button>
      </div>
    </header>
  );
}
