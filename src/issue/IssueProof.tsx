import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { CONTENTS_ID, type ContentsDesign, type ContentsEntry, type IssuePlan } from './model';
import { ContentsSpread } from './ContentsSpread';
import { PaperPreviewLayout } from '../paper/PaperPreview';
import type { IssueSourceDocument } from './IssueRenderer';
import type { Doc } from '../schema/document';
import type { PdfPageSize } from '../lib/pdfPageSize';
import { ExternalPdfPages } from './ExternalPdfPages';
import { waitForPreviewResources } from '../lib/pdfExport';
import {CanvasBleedGuides} from '../paper/CanvasBleedGuides';

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
export function IssueProof({ plan, entries, documents, magazineName, design, contentsStart, contentsSide = 'left', pageSize = 'a4', pagesRef, onOverflow, scale, onPageCounts, onPending, onError,bleedMm=0 }: {
  plan: IssuePlan; entries: readonly ContentsEntry[]; documents: readonly IssueSourceDocument[];
  magazineName: string; design?: ContentsDesign; contentsStart: number; scale: number;
  contentsSide?: 'left' | 'right';
  pageSize?: PdfPageSize;
  bleedMm?:number;
  pagesRef: RefObject<HTMLDivElement | null>; onOverflow: (overflow: boolean) => void;
  onPageCounts?:(counts:Record<string,number>)=>void; onPending?:()=>void; onError?:(error:Error)=>void;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const docs = new Map(documents.map(source => [source.id, source]));
  const handlers=useRef({onPageCounts,onPending,onError});handlers.current={onPageCounts,onPending,onError};
  useEffect(()=>{
    if(!handlers.current.onPageCounts)return;
    let alive=true;handlers.current.onPending?.();
    const run=async()=>{
      const root=pagesRef.current;if(!root)return;
      await waitForPreviewResources(root);
      if(!alive)return;
      const counts=Object.fromEntries([...root.querySelectorAll<HTMLElement>('[data-issue-article]')].map(host=>[host.dataset.issueArticle!,host.querySelectorAll('.pages > .page').length]));
      handlers.current.onPageCounts?.(counts);
    };
    void run().catch(error=>{if(alive)handlers.current.onError?.(error instanceof Error?error:new Error('Could not verify the issue proof.'));});
    return()=>{alive=false;};
  },[documents,pageSize,pagesRef]);

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
  }, [pagesRef, documents, entries.length, pageSize]);

  // Where the contents spread sits in the reading order. An arrangement that
  // somehow carries no contents slot still shows every article, with the
  // spread after them, rather than silently repeating the whole issue.
  const position = plan.order.indexOf(CONTENTS_ID);
  const split = position < 0 ? plan.order.length : position;
  const article = (id: string) => {
    const source = docs.get(id);
    return source?.externalPdf ? <div key={id} className="issue-proof-doc" data-issue-article={id}><ExternalPdfPages pdf={source.externalPdf} size={pageSize} bleedMm={bleedMm}/></div>
      : source ? <Article key={id} id={id} doc={source.doc} /> : null;
  };
  return <div className="issue-proof-frame" style={{ width: box.width * scale, height: box.height * scale }}>
    <div ref={pagesRef} className="issue-proof-pages" aria-hidden="true"
      style={{ direction: plan.direction, transform: `scale(${scale})` }}>
      {plan.order.slice(0, split).map(article)}
      <div className="pages issue-proof-contents">
        <ContentsSpread entries={entries} title={plan.contentsTitle} subtitle={plan.contentsSubtitle}
          direction={plan.direction} startNumber={contentsStart} magazineName={magazineName}
          design={design} mastheadSide={contentsSide} pageSize={pageSize} bleedMm={bleedMm} onOverflow={onOverflow} />
      </div>
      {plan.order.slice(split + 1).map(article)}
    </div>
    <CanvasBleedGuides root={pagesRef} size={pageSize} bleedMm={bleedMm} bleedCanvas pageSelector=".issue-proof-contents .page,.issue-external-pdf-page"/>
  </div>;
}
