import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { IssueCompiler, reconcileCompiledProof, type CompiledIssue } from './IssueCompiler';
import { defaultIssuePlan } from './model';
import { emptyDoc } from '../schema/document';
import type { IssueSourceDocument, RenderedIssueDocument } from './IssueRenderer';
const measurement = vi.hoisted(() => ({ unstable: false, pass: 0 }));

vi.mock('./IssueRenderer', () => ({ IssueRenderer: ({ documents, onComplete }: {
  documents: IssueSourceDocument[]; onComplete: (docs: RenderedIssueDocument[]) => void;
}) => {
  useEffect(() => {
    let live = true;
    queueMicrotask(() => { if (live) { measurement.pass++; onComplete(documents.map(source => ({ ...source, pageCount: measurement.unstable ? measurement.pass : source.id === 'a' ? 3 : 1, pages: [] })) as unknown as RenderedIssueDocument[]); } });
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

it('does not mark a non-converging issue ready with incorrect page numbering', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  measurement.unstable = true; measurement.pass = 0;
  const host = document.createElement('div'), root = createRoot(host);
  const items = [{ id: 'a', name: 'a', version: 1, updated: 0, doc: emptyDoc() }];
  const complete = vi.fn(), error = vi.fn();
  try {
    await act(async () => root.render(<IssueCompiler items={items} sources={items} plan={defaultIssuePlan(items)} onComplete={complete} onError={error} />));
    expect(complete).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0].message).toContain('page counts keep changing');
  } finally { measurement.unstable = false; act(() => root.unmount()); vi.unstubAllGlobals(); }
});

it('renumbers from all settled proof pages without filtering contents membership or mutating articles',()=>{
  const items=['a','b'].map(id=>({id,name:id,version:1,updated:0,doc:emptyDoc()}));
  const plan={...defaultIssuePlan(items),contentsExcluded:['a','b']};
  const initial:CompiledIssue={plan,numbered:items,documents:[],counts:{a:3,b:1},assignments:[]};
  const before=JSON.stringify(items);
  const settled=reconcileCompiledProof(initial,{a:1,b:1});
  expect(settled.assignments.map(row=>[row.id,row.startNumber,row.pageCount])).toEqual([['__contents__',1,2],['a',3,1],['b',4,1]]);
  expect(settled.numbered.map(source=>source.doc.footer?.startNumber)).toEqual([3,4]);
  expect(reconcileCompiledProof(settled,{a:1,b:1})).toBe(settled);
  expect(JSON.stringify(items)).toBe(before);
  expect(()=>reconcileCompiledProof(initial,{a:0,b:1})).toThrow();
});
