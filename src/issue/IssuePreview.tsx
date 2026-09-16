import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CONTENTS_ID, type ContentsEntry, type IssueAssignment, type IssuePlan } from './model';
import { ContentsSpread } from './ContentsSpread';
import type { RenderedIssueDocument } from './IssueRenderer';

const PAGE_WIDTH = 210 * 96 / 25.4;
const PAGE_HEIGHT = 297 * 96 / 25.4;
/** Matches the grid gap in issue.css; it sits inside the scaled box, so the
 * frame has to account for it at the same scale the sheets are drawn at. */
const PAGE_GAP = 20;
const ZOOM_MIN = 0.15, ZOOM_MAX = 2;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function IssuePreview({ plan, entries, assignments, rendered, showAll, magazineName, pagesRef, onOverflow }: {
  plan: IssuePlan; entries: ContentsEntry[]; assignments: IssueAssignment[]; rendered: RenderedIssueDocument[];
  showAll: boolean; magazineName: string; pagesRef: RefObject<HTMLDivElement | null>; onOverflow: (overflow: boolean) => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Fit is the landing state, but an issue proof is read at reading size: an
  // editor checking a caption or a folio against the article it came from
  // cannot do it at the 40% the pane happens to allow. The editor's own
  // preview has had Fit/zoom/spread since the beginning — the issue proof was
  // the one surface that pinned you to whatever scale the window implied.
  const [view, setView] = useState<'auto' | 1 | 2>('auto');
  const [zoom, setZoom] = useState<'fit' | number>('fit');

  useLayoutEffect(() => {
    const host = viewRef.current;
    if (!host) return;
    const update = () => setWidth(host.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = pagesRef.current;
    if (!root) return;
    root.querySelectorAll(':scope > [data-issue-article]').forEach(page => page.remove());
    if (!showAll) return;
    const anchor = [...root.children].find(child => child.classList.contains('page')) ?? null;
    let beforeContents = true;
    for (const id of plan.order) {
      if (id === CONTENTS_ID) { beforeContents = false; continue; }
      const article = rendered.find(item => item.id === id);
      const assignment = assignments.find(item => item.id === id);
      if (!article || !assignment) continue;
      article.pages.forEach((source, index) => {
        const page = source.cloneNode(true) as HTMLElement;
        page.dataset.issueArticle = id;
        page.style.removeProperty('margin');
        const number = assignment.startNumber + index;
        page.querySelectorAll('.page-folio-number').forEach(folio => { folio.textContent = String(number); });
        page.querySelectorAll('.page-folio').forEach(folio => { folio.setAttribute('aria-label', `Page ${number}`); });
        if (beforeContents) root.insertBefore(page, anchor); else root.appendChild(page);
      });
    }
  }, [plan, assignments, rendered, showAll, pagesRef]);

  const available = Math.max(180, width - 32);
  const columns = view === 'auto' ? (available >= 650 ? 2 : 1) : view;
  const contentWidth = PAGE_WIDTH * columns + (columns - 1) * PAGE_GAP;
  const fitScale = clamp(available / contentWidth, ZOOM_MIN, 1);
  const scale = zoom === 'fit' ? fitScale : zoom;
  const step = (delta: number) => setZoom(current => clamp((current === 'fit' ? fitScale : current) + delta, ZOOM_MIN, ZOOM_MAX));

  const pageCount = showAll ? assignments.reduce((total, item) => total + item.pageCount, 0) : 2;
  const rows = Math.max(1, Math.ceil(pageCount / columns));
  const contents = assignments.find(item => item.id === CONTENTS_ID);
  return <div className="issue-preview">
    <div className="issue-preview-bar">
      <div className="view-bar" role="group" aria-label="Sheets per row">
        <button type="button" className={`view-btn${columns === 1 ? ' is-active' : ''}`} aria-pressed={columns === 1} onClick={() => setView(1)}>Single</button>
        <button type="button" className={`view-btn${columns === 2 ? ' is-active' : ''}`} aria-pressed={columns === 2} onClick={() => setView(2)}>Spread</button>
      </div>
      <div className="zoom-bar">
        <button type="button" className={`zoom-btn${zoom === 'fit' ? ' is-active' : ''}`} onClick={() => setZoom('fit')}>Fit</button>
        <button type="button" className="zoom-btn" onClick={() => step(-0.1)} title="Zoom out" aria-label="Zoom out">−</button>
        <span className="zoom-val">{Math.round(scale * 100)}%</span>
        <button type="button" className="zoom-btn" onClick={() => step(0.1)} title="Zoom in" aria-label="Zoom in">+</button>
        <button type="button" className={`zoom-btn${zoom === 1 ? ' is-active' : ''}`} onClick={() => setZoom(1)}>100%</button>
      </div>
    </div>
    <div className="issue-preview-view" ref={viewRef}>
      <div className="issue-preview-frame" style={{ width: contentWidth * scale, height: (PAGE_HEIGHT * rows + (rows - 1) * PAGE_GAP) * scale }}>
        <div ref={pagesRef} className="pages issue-preview-pages" style={{ transform: `scale(${scale})`, gridTemplateColumns: `repeat(${columns},210mm)`, direction: plan.direction }}>
          <ContentsSpread entries={entries} title={plan.contentsTitle} subtitle={plan.contentsSubtitle} direction={plan.direction} startNumber={contents?.startNumber ?? plan.startNumber} magazineName={magazineName} onOverflow={onOverflow} />
        </div>
      </div>
    </div>
  </div>;
}
