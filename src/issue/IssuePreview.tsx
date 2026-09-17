import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CONTENTS_ID, documentWithIssueNumber, type ContentsDesign, type ContentsEntry, type IssueAssignment, type IssueItem, type IssuePlan } from './model';
import { ContentsSpread } from './ContentsSpread';
import { PaperPreviewLayout } from '../paper/PaperPreview';

const PAGE_WIDTH = 210 * 96 / 25.4;
const PAGE_HEIGHT = 297 * 96 / 25.4;
/** Matches the grid gap in issue.css; it sits inside the scaled box, so the
 * frame has to account for it at the same scale the sheets are drawn at. */
const PAGE_GAP = 20;
const ZOOM_MIN = 0.15, ZOOM_MAX = 2;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * The proof shows each article through the editor's own preview component,
 * not through a copy of its output.
 *
 * It used to snapshot every article's finished DOM and clone the sheets into
 * this grid. That is where the drift came from: a detached sheet loses what it
 * inherited, so the snapshot had to re-pin typography onto it by hand, and a
 * computed line-height pinned as an absolute length gave every smaller
 * descendant the wrong line box. Rendering the real component here means there
 * is no copy to go stale — the compiled issue and the single-article preview
 * are the same code path, and page numbering arrives as data through
 * documentWithIssueNumber instead of being written over the folio text.
 *
 * `display: contents` on each article's own wrapper chain (issue.css) drops
 * those boxes out of layout so the sheets themselves become the grid items,
 * while the elements stay in the DOM — so every `.pages ...` rule, RTL flag and
 * inherited custom property still applies exactly as it does in the editor.
 */
export function IssuePreview({ plan, entries, assignments, items, showAll, magazineName, design, pagesRef, onOverflow }: {
  plan: IssuePlan; entries: ContentsEntry[]; assignments: IssueAssignment[]; items: readonly IssueItem[];
  showAll: boolean; magazineName: string; design?: ContentsDesign;
  pagesRef: RefObject<HTMLDivElement | null>; onOverflow: (overflow: boolean) => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Fit is the landing state, but an issue proof is read at reading size: an
  // editor checking a caption or a folio against the article it came from
  // cannot do it at the 40% the pane happens to allow.
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

  // Numbering is part of the document the preview receives, so the folio is
  // rendered by the same footer code the editor uses rather than patched into
  // the DOM afterwards.
  const numbered = useMemo(() => {
    const starts = new Map(assignments.map(row => [row.id, row.startNumber]));
    return new Map(items.map(item => {
      const start = starts.get(item.id);
      return [item.id, start === undefined ? item.doc : documentWithIssueNumber(item.doc, start)];
    }));
  }, [items, assignments]);

  const available = Math.max(180, width - 32);
  const columns = view === 'auto' ? (available >= 650 ? 2 : 1) : view;
  const contentWidth = PAGE_WIDTH * columns + (columns - 1) * PAGE_GAP;
  const fitScale = clamp(available / contentWidth, ZOOM_MIN, 1);
  const scale = zoom === 'fit' ? fitScale : zoom;
  const step = (delta: number) => setZoom(current => clamp((current === 'fit' ? fitScale : current) + delta, ZOOM_MIN, ZOOM_MAX));

  const pageCount = showAll ? assignments.reduce((total, item) => total + item.pageCount, 0) : 2;
  const rows = Math.max(1, Math.ceil(pageCount / columns));
  const contents = assignments.find(item => item.id === CONTENTS_ID);
  const split = plan.order.indexOf(CONTENTS_ID);
  const article = (id: string) => {
    const doc = numbered.get(id);
    return doc ? <div key={id} className="issue-article" data-issue-article={id}>
      <PaperPreviewLayout doc={doc} toolbarHost={null} pending={false} readOnly />
    </div> : null;
  };

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
          {showAll && split > 0 && plan.order.slice(0, split).map(article)}
          <ContentsSpread entries={entries} title={plan.contentsTitle} subtitle={plan.contentsSubtitle} direction={plan.direction} startNumber={contents?.startNumber ?? plan.startNumber} magazineName={magazineName} design={design} onOverflow={onOverflow} />
          {showAll && plan.order.slice(split + 1).map(article)}
        </div>
      </div>
    </div>
  </div>;
}
