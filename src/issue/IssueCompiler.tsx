import { useCallback, useEffect, useRef, useState } from 'react';
import { assignIssuePages, documentWithIssueNumber, type IssueAssignment, type IssueItem, type IssuePlan } from './model';
import { IssueRenderer, type IssueSourceDocument, type RenderedIssueDocument } from './IssueRenderer';

export interface CompiledIssue {
  /** Finished sheets, carrying this issue's page numbers, in plan order. */
  documents: RenderedIssueDocument[];
  counts: Record<string, number>;
  assignments: IssueAssignment[];
  /** The arrangement these sheets were built from. Anything the editor has
   * changed since is not in the pages on screen, which is what lets the
   * workspace say so honestly instead of silently showing stale proofs. */
  plan: IssuePlan;
}

export interface CompileProgress { completed: number; total: number; name: string; pass: number; passes: number }

/**
 * One compile of the whole issue, run through the single-article engine.
 *
 * An article's own page numbers are part of its layout, and its page numbers
 * depend on how many pages every article before it turned out to need — so the
 * two facts define each other and a single pass cannot know both. The compiler
 * settles it the way a print shop does: measure the issue once to learn the
 * page counts, work out the folios from those counts, then set the issue again
 * with the real numbers in place. The second pass is the one that produces the
 * sheets; the first exists only to number them.
 *
 * Counts are re-checked after each pass and the issue is set again if they
 * moved (a folio wide enough to change an article's own pagination), so the
 * numbers printed on the sheets always match the sheets that were printed.
 * In practice a folio never changes a count and this converges on pass two.
 */
const MAX_PASSES = 4;

export function IssueCompiler({ sources, plan, items, onComplete, onError, onProgress }: {
  sources: readonly IssueSourceDocument[];
  plan: IssuePlan;
  items: readonly IssueItem[];
  onComplete: (result: CompiledIssue) => void;
  onError: (error: Error) => void;
  onProgress?: (progress: CompileProgress) => void;
}) {
  const [pass, setPass] = useState(0);
  const [documents, setDocuments] = useState<readonly IssueSourceDocument[]>(sources);
  const previousCounts = useRef('');
  // The arrangement is captured when this compile starts. A compile that
  // renumbered itself against a plan the editor had meanwhile changed would
  // print folios from one arrangement onto sheets ordered by another.
  const frozen = useRef({ plan, items });
  const handlers = useRef({ onComplete, onError, onProgress });
  useEffect(() => { handlers.current = { onComplete, onError, onProgress }; }, [onComplete, onError, onProgress]);
  useEffect(() => {
    frozen.current = { plan, items };
    previousCounts.current = '';
    setPass(0);
    setDocuments(sources);
    // A new compile starts only when its sources do: `plan` and `items` are
    // read here as the arrangement at that moment, deliberately not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  const complete = useCallback((rendered: RenderedIssueDocument[]) => {
    const counts = Object.fromEntries(rendered.map(article => [article.id, article.pageCount]));
    let assignments: IssueAssignment[];
    try { assignments = assignIssuePages(frozen.current.plan, frozen.current.items, counts); }
    catch (failure) {
      handlers.current.onError(failure instanceof Error ? failure : new Error('The pages could not be numbered.'));
      return;
    }
    const signature = JSON.stringify(counts);
    const settled = pass > 0 && signature === previousCounts.current;
    previousCounts.current = signature;
    if (settled || pass + 1 >= MAX_PASSES) {
      handlers.current.onComplete({ documents: rendered, counts, assignments, plan: frozen.current.plan });
      return;
    }
    const starts = new Map(assignments.map(row => [row.id, row.startNumber]));
    setDocuments(sources.map(source => {
      const start = starts.get(source.id);
      return start === undefined ? source : { ...source, doc: documentWithIssueNumber(source.doc, start) };
    }));
    setPass(pass + 1);
  }, [pass, sources]);

  const progress = useCallback((completed: number, total: number, name: string) => {
    handlers.current.onProgress?.({ completed, total, name, pass: pass + 1, passes: 2 });
  }, [pass]);

  return <IssueRenderer key={pass} documents={documents} onComplete={complete} onError={onError} onProgress={progress} />;
}
