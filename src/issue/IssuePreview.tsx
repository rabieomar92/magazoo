import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CONTENTS_ID, type ContentsEntry, type IssueAssignment, type IssuePlan } from './model';
import { ContentsSpread } from './ContentsSpread';
import type { RenderedIssueDocument } from './IssueRenderer';

const PAGE_WIDTH = 210 * 96 / 25.4;
const PAGE_HEIGHT = 297 * 96 / 25.4;

export function IssuePreview({ plan, entries, assignments, rendered, showAll, magazineName, pagesRef, onOverflow }: {
  plan: IssuePlan; entries: ContentsEntry[]; assignments: IssueAssignment[]; rendered: RenderedIssueDocument[];
  showAll: boolean; magazineName: string; pagesRef: RefObject<HTMLDivElement | null>; onOverflow: (overflow: boolean) => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: .4, columns: 2 });
  useLayoutEffect(() => {
    const host = viewRef.current;
    if (!host) return;
    const update = () => {
      const available = Math.max(180, host.clientWidth - 32);
      const columns = available >= 650 ? 2 : 1;
      setSize({ columns, scale: Math.min(1, available / (PAGE_WIDTH * columns + (columns - 1) * 20)) });
    };
    update(); const observer = new ResizeObserver(update); observer.observe(host);
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
  const pageCount = showAll ? assignments.reduce((total, item) => total + item.pageCount, 0) : 2;
  const contents = assignments.find(item => item.id === CONTENTS_ID);
  return <div className="issue-preview-view" ref={viewRef}>
    <div className="issue-preview-frame" style={{ width: (PAGE_WIDTH * size.columns + (size.columns - 1) * 20) * size.scale, height: (Math.ceil(pageCount / size.columns) * (PAGE_HEIGHT + 20)) * size.scale }}>
      <div ref={pagesRef} className="pages issue-preview-pages" style={{ transform: `scale(${size.scale})`, gridTemplateColumns: `repeat(${size.columns},210mm)`, direction: plan.direction }}>
        <ContentsSpread entries={entries} title={plan.contentsTitle} subtitle={plan.contentsSubtitle} direction={plan.direction} startNumber={contents?.startNumber ?? plan.startNumber} magazineName={magazineName} onOverflow={onOverflow} />
      </div>
    </div>
  </div>;
}
