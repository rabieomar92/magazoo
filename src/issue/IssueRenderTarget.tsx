import { useMemo, type RefObject } from 'react';
import { CONTENTS_ID, documentWithIssueNumber, type ContentsDesign, type ContentsEntry, type IssueAssignment, type IssueItem, type IssuePlan } from './model';
import { ContentsSpread } from './ContentsSpread';
import { PaperPreviewLayout } from '../paper/PaperPreview';

/**
 * Compiles the issue with the exact engine the editor already uses for one
 * article — never a separate renderer, never a snapshot of finished output.
 * This host has no on-screen presence: the workspace only lets the editor
 * arrange articles, and this is where that arrangement actually becomes
 * pages, off-screen, for both the contents fit-check and the PDF export.
 */
export function IssueRenderTarget({ plan, entries, assignments, items, showAll, magazineName, design, pagesRef, onOverflow }: {
  plan: IssuePlan; entries: ContentsEntry[]; assignments: IssueAssignment[]; items: readonly IssueItem[];
  showAll: boolean; magazineName: string; design?: ContentsDesign;
  pagesRef: RefObject<HTMLDivElement | null>; onOverflow: (overflow: boolean) => void;
}) {
  const numbered = useMemo(() => {
    const starts = new Map(assignments.map(row => [row.id, row.startNumber]));
    return new Map(items.map(item => {
      const start = starts.get(item.id);
      return [item.id, start === undefined ? item.doc : documentWithIssueNumber(item.doc, start)];
    }));
  }, [items, assignments]);

  const contents = assignments.find(item => item.id === CONTENTS_ID);
  const split = plan.order.indexOf(CONTENTS_ID);
  const article = (id: string) => {
    const doc = numbered.get(id);
    return doc ? <div key={id} className="issue-article" data-issue-article={id}>
      <PaperPreviewLayout doc={doc} toolbarHost={null} pending={false} readOnly />
    </div> : null;
  };

  return <div ref={pagesRef} className="pages issue-render-target" aria-hidden="true" style={{ direction: plan.direction }}>
    {showAll && split > 0 && plan.order.slice(0, split).map(article)}
    <ContentsSpread entries={entries} title={plan.contentsTitle} subtitle={plan.contentsSubtitle} direction={plan.direction} startNumber={contents?.startNumber ?? plan.startNumber} magazineName={magazineName} design={design} onOverflow={onOverflow} />
    {showAll && plan.order.slice(split + 1).map(article)}
  </div>;
}
