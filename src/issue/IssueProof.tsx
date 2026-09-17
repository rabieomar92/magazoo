import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CONTENTS_ID, type ContentsDesign, type ContentsEntry, type IssuePlan } from './model';
import { ContentsSpread } from './ContentsSpread';
import type { RenderedIssueDocument } from './IssueRenderer';

/** Attach one article's finished sheets. The compiler keeps the originals as
 * its masters, so what goes on screen is a copy — the same copy the exporter
 * would take. Each article keeps its own `.pages` container: that is the unit
 * the PDF path groups and clones by, and it is what stops the stylesheet's
 * per-container rules from letting one article's last sheet share a leaf with
 * the next article's first. */
function ArticleSheets({ id, pages }: { id: string; pages: readonly HTMLElement[] }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    node.replaceChildren(...pages.map(page => page.cloneNode(true) as HTMLElement));
    return () => node.replaceChildren();
  }, [pages]);
  return <div ref={host} className="pages issue-proof-doc" data-issue-article={id} />;
}

/**
 * The compiled issue, on screen.
 *
 * These are not a second rendering of the articles — they are the very sheets
 * the compiler produced and the exporter prints, mounted where the editor can
 * see them. There is only one pagination engine in this application and only
 * one set of pages per compile, so "what the preview shows" and "what the PDF
 * contains" are the same object rather than two renderings that have to be
 * kept in agreement. The contents spread is the one live part, because it is
 * the thing being designed here; it measures and fits itself exactly as it
 * does when the issue is exported.
 */
export function IssueProof({ plan, entries, documents, magazineName, design, contentsStart, pagesRef, onOverflow, scale }: {
  plan: IssuePlan; entries: readonly ContentsEntry[]; documents: readonly RenderedIssueDocument[];
  magazineName: string; design?: ContentsDesign; contentsStart: number; scale: number;
  pagesRef: RefObject<HTMLDivElement | null>; onOverflow: (overflow: boolean) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const sheets = new Map(documents.map(article => [article.id, article.pages]));

  // The sheets are a fixed physical size; the pane is whatever width the
  // window leaves. Scaling the whole stack keeps every sheet at its true
  // proportions, and the frame reserves the scaled footprint so the pane
  // scrolls over the preview rather than clipping it.
  useLayoutEffect(() => {
    const pages = pagesRef.current;
    if (!pages) return;
    const measure = () => setBox({ width: pages.offsetWidth, height: pages.offsetHeight });
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(pages);
    return () => observer?.disconnect();
  }, [pagesRef, documents, entries.length]);

  // Where the contents spread sits in the reading order. An arrangement that
  // somehow carries no contents slot still shows every article, with the
  // spread after them, rather than silently repeating the whole issue.
  const position = plan.order.indexOf(CONTENTS_ID);
  const split = position < 0 ? plan.order.length : position;
  const article = (id: string) => {
    const pages = sheets.get(id);
    return pages ? <ArticleSheets key={id} id={id} pages={pages} /> : null;
  };
  return <div ref={frame} className="issue-proof-frame" style={{ width: box.width * scale, height: box.height * scale }}>
    <div ref={pagesRef} className="pages issue-proof-pages" aria-hidden="true"
      style={{ direction: plan.direction, transform: `scale(${scale})` }}>
      {plan.order.slice(0, split).map(article)}
      <ContentsSpread entries={entries} title={plan.contentsTitle} subtitle={plan.contentsSubtitle}
        direction={plan.direction} startNumber={contentsStart} magazineName={magazineName}
        design={design} onOverflow={onOverflow} />
      {plan.order.slice(split + 1).map(article)}
    </div>
  </div>;
}
