import { useCallback, useEffect, useRef, useState } from 'react';
import { useDoc } from './store/useDoc';
import { hydrate, startAutosave } from './store/persist';
import { Toolbar } from './panel/Toolbar';
import { Panel } from './panel/Panel';
import { PaperPreview } from './paper/PaperPreview';
import { ErrorBoundary } from './ErrorBoundary';
import { sampleDoc } from './sample';
import './styles/fonts.css';
import './styles/page.css';
import './styles/paper2.css';
import './styles/magazine.css';
import './styles/gallery.css';
import './styles/overflow.css';
import './styles/panel.css';
import './styles/panel-layout.css';

const DEFAULT_PANEL_W = 380;
const MIN_PANEL_W = 320;
const MOBILE_WORKSPACE_MAX = 720;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_W);
  const [isCollapsed, setIsCollapsed] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(`(max-width: ${MOBILE_WORKSPACE_MAX}px)`).matches,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [toolbarPreviewHost, setToolbarPreviewHost] = useState<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // Restore the last session, then keep mirroring edits to IndexedDB. Seed a
  // real highlight only on a genuinely empty first run. The `ready` gate avoids
  // flashing the sample before a stored doc loads.
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    (async () => {
      // `ready` gates the entire UI (see the `if (!ready) return <div className="app" />`
      // below) — an exception ANYWHERE in this block, uncaught, leaves that div
      // blank forever with no error shown. hydrate() already catches its own
      // failure modes and reports 'error' rather than throwing, but this outer
      // try/finally is a second safety net: whatever goes wrong, `ready` still
      // flips to true so the app (and, if something did break, the
      // ErrorBoundary around it) actually renders something.
      try {
        const result = await hydrate();
        if (cancelled) return;
        if (result === 'error') {
          // The stored doc couldn't be read (broken/blocked IndexedDB). Don't seed
          // a sample and don't autosave: either would overwrite a row that may be
          // recoverable on the next launch. Warn and let the user Save to a file.
          setLoadFailed(true);
          return;
        }
        // Seed the sample whenever the doc is blank — a genuinely empty first run,
        // or a previously-autosaved empty doc that hydrate() faithfully restored.
        // An empty canvas is never what you want to look at.
        const { doc, load } = useDoc.getState();
        const blank =
          !doc.meta.title && doc.blocks.every((b) => b.type !== 'paragraph' || !b.text.trim());
        if (blank) load(sampleDoc());
        stop = startAutosave();
      } catch (err) {
        console.error('Startup failed:', err);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  // A phone opens on the useful full-width preview; its editor is a drawer
  // reached through the same splitter toggle. Crossing back to tablet/desktop
  // restores the side-by-side workspace automatically.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const compact = window.matchMedia(`(max-width: ${MOBILE_WORKSPACE_MAX}px)`);
    const onViewportChange = (event: MediaQueryListEvent) => setIsCollapsed(event.matches);
    compact.addEventListener('change', onViewportChange);
    return () => compact.removeEventListener('change', onViewportChange);
  }, []);

  const startDragging = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (
      e.button !== 0 ||
      window.innerWidth <= MOBILE_WORKSPACE_MAX ||
      (e.target as HTMLElement).closest('button')
    ) return;
    e.preventDefault();
    draggingRef.current = true;
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      const maxW = Math.min(650, window.innerWidth - 300);
      const newW = clamp(moveEvent.clientX, MIN_PANEL_W, maxW);
      setPanelWidth(newW);
      setIsCollapsed(false);
    };

    const onPointerUp = () => {
      draggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, []);

  const toggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed((prev) => !prev);
  }, []);

  const resetWidth = useCallback(() => {
    setPanelWidth(DEFAULT_PANEL_W);
    setIsCollapsed(false);
  }, []);

  if (!ready) return <div className="app" />;

  return (
    <ErrorBoundary>
      <div className="app">
        <Toolbar onPreviewToolsHost={setToolbarPreviewHost} />
        {loadFailed && (
          <div className="app-banner" role="alert">
            Failed to restore saved session. Changes will not be autosaved — use Save As… to
            secure your work.
          </div>
        )}
        <div
          className={`workspace${isDragging ? ' is-dragging' : ''}${isCollapsed ? ' is-collapsed' : ''}`}
          style={{ '--panel-w': `${panelWidth}px` } as React.CSSProperties}
        >
          <Panel />
          <div
            className={`splitter${isDragging ? ' is-dragging' : ''}`}
            onPointerDown={startDragging}
            onDoubleClick={resetWidth}
            title="Drag to resize sidebar · Double-click to reset width"
          >
            <button
              type="button"
              className="splitter-toggle"
              onClick={toggleCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? '▶' : '◀'}
            </button>
          </div>
          <PaperPreview toolbarHost={toolbarPreviewHost} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
