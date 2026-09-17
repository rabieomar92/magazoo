import { memo, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CONTENTS_ID, type ContentsDesign, type ContentsEntry, type IssuePlan } from './model';
import { ContentsSpread } from './ContentsSpread';
import { PaperPreviewLayout } from '../paper/PaperPreview';
import type { IssueSourceDocument } from './IssueRenderer';
import type { Doc } from '../schema/document';

/**
 * One article in the compiled issue — the article's own editor preview.
 *
 * Not a copy of it, not a snapshot of it: the same component, given the same
 * document, in the same read-only mode the editor uses when it is not being
 * typed into. Whatever the editor puts on a sheet, this puts on a sheet,
 * because it is the same code reading the same data. The export then clones
 * these very elements with the same function the single-article export uses.
 *
 * Memoised on the document object, which only changes when the issue is
 * compiled again — so rewording a contents line, recolouring the spread or
 * dragging a crop never re-paginates a single article.
 */
const Article = memo(function Article({ id, doc }: { id: string; doc: Doc }) {
  return <div className="issue-proof-doc" data-issue-article={id}>
    <PaperPreviewLayout doc={doc} toolbarHost={null} pending={false} readOnly />
  </div>;
});

/**
 * The compiled issue, on screen.
 *
 * The articles are live editor previews; the contents spread is the live
 * spread. There is no intermediate rendering anywhere in this pane, so
 * "what the preview shows" and "what the editor shows" cannot disagree —
 * and `exportIssuePdf` prints these same elements, one `clonePages` call per
 * article, exactly as printing that article on its own would.
 */
export function IssueProof({ plan, entries, documents, magazineName, design, contentsStart, pagesRef, onOverflow, scale }: {
  plan: IssuePlan; entries: readonly ContentsEntry[]; documents: readonly IssueSourceDocument[];
  magazineName: string; design?: ContentsDesign; contentsStart: number; scale: number;
  pagesRef: RefObject<HTMLDivElement | null>; onOverflow: (overflow: boolean) => void;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const docs = new Map(documents.map(source => [source.id, source.doc]));

  // The sheets are a fixed physical size; the pane is whatever width the
  // window leaves. Scaling the whole stack keeps every sheet at its true
  // proportions, and the frame reserves the scaled footprint so the pane
  // scrolls over the preview rather than clipping it.
  const measured = useRef({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const pages = pagesRef.current;
    if (!pages) return;
    const measure = () => {
      const next = { width: pages.offsetWidth, height: pages.offsetHeight };
      if (next.width === measured.current.width && next.height === measured.current.height) return;
      measured.current = next;
      setBox(next);
    };
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
    const doc = docs.get(id);
    return doc ? <Article key={id} id={id} doc={doc} /> : null;
  };
  return <div className="issue-proof-frame" style={{ width: box.width * scale, height: box.height * scale }}>
    <div ref={pagesRef} className="issue-proof-pages" aria-hidden="true"
      style={{ direction: plan.direction, transform: `scale(${scale})` }}>
      {plan.order.slice(0, split).map(article)}
      <div className="pages issue-proof-contents">
        <ContentsSpread entries={entries} title={plan.contentsTitle} subtitle={plan.contentsSubtitle}
          direction={plan.direction} startNumber={contentsStart} magazineName={magazineName}
          design={design} onOverflow={onOverflow} />
      </div>
      {plan.order.slice(split + 1).map(article)}
    </div>
  </div>;
}
