import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { IssueCompiler, type CompiledIssue } from './IssueCompiler';
import { defaultIssuePlan } from './model';
import { emptyDoc } from '../schema/document';
import type { IssueSourceDocument, RenderedIssueDocument } from './IssueRenderer';

vi.mock('./IssueRenderer', () => ({ IssueRenderer: ({ documents, onComplete }: {
  documents: IssueSourceDocument[]; onComplete: (docs: RenderedIssueDocument[]) => void;
}) => {
  useEffect(() => {
    let live = true;
    queueMicrotask(() => { if (live) onComplete(documents.map(source => ({ ...source, pageCount: source.id === 'a' ? 3 : 1, pages: [] })) as unknown as RenderedIssueDocument[]); });
    return () => { live = false; };
  }, [documents, onComplete]);
  return null;
} }));

it('renders the settled compiler documents with issue-wide masthead sides without changing sources', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); const root = createRoot(host);
  const items = ['cover', 'a', 'b'].map(id => ({ id, name: id, version: 1, updated: 0,
    doc: { ...emptyDoc(), templateId: id === 'cover' ? 'magazine-4' as const : 'paper-1' as const } }));
  const before = JSON.stringify(items);
  const plan = { ...defaultIssuePlan(items), countCovers: true, startNumber: 2 };
  let result: CompiledIssue | undefined;
  const error = vi.fn();
  try {
    await act(async () => root.render(<IssueCompiler items={items} sources={items} plan={plan} onComplete={value => { result = value; }} onError={error} />));
    expect(error).not.toHaveBeenCalled();
    expect(result?.numbered.map(source => source.doc.design.barSide)).toEqual([items[0].doc.design.barSide, 'left', 'right']);
    expect(result?.assignments.map(row => row.startNumber)).toEqual([2, 3, 5, 8]);
    expect(JSON.stringify(items)).toBe(before);
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});
