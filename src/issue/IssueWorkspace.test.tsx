import { act, useEffect, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import IssueWorkspace from './IssueWorkspace';
import { issueApi } from './api';
import { exportIssuePdf } from '../lib/pdfExport';
import { assignIssuePages, defaultIssuePlan, type IssueResponse } from './model';
import { emptyDoc } from '../schema/document';
import type { IssueCompiler as Compiler } from './IssueCompiler';
import type { IssueProof as Proof } from './IssueProof';

vi.mock('./api', () => ({ issueApi: vi.fn() }));
vi.mock('../lib/pdfExport', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/pdfExport')>(),
  exportIssuePdf: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./IssueCompiler', () => ({
  IssueCompiler: ({ sources, items, plan, onComplete }: ComponentProps<typeof Compiler>) => {
    useEffect(() => {
      const counts = Object.fromEntries(items.map(item => [item.id, 1]));
      onComplete({ numbered: sources, documents: [], counts, assignments: assignIssuePages(plan, items, counts), plan });
    }, [sources, items, plan, onComplete]);
    return null;
  },
}));
vi.mock('./IssueProof', () => ({
  IssueProof: ({ pagesRef, onOverflow }: ComponentProps<typeof Proof>) => {
    useEffect(() => onOverflow(false), [onOverflow]);
    return <div ref={pagesRef}><div className="pages"><section className="page" /><section className="page" /><section className="page" /></div></div>;
  },
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let response: IssueResponse;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  const items = [{ id: 'article', name: 'A science story', version: 3, updated: 0, doc: emptyDoc() }];
  response = { project: { id: 'project', name: 'Test magazine' }, version: 7, items, plan: defaultIssuePlan(items) };
  vi.mocked(issueApi).mockResolvedValue(response);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it.each(['a4', 'b5', 'magazine'])('exports the compiled issue at %s without saving or finalising the source data', async size => {
  const before = JSON.stringify(response);
  await act(async () => root.render(<IssueWorkspace projectId="project" csrf="test-token" onClose={() => undefined} />));
  act(() => host.querySelector<HTMLButtonElement>('#tab-output')!.click());

  const select = host.querySelector<HTMLSelectElement>('#panel-output select')!;
  expect([...select.options].map(option => option.textContent)).toEqual([
    'A4 · 210 × 297 mm', 'B5 (ISO) · 176 × 250 mm', 'Magazine · 203 × 267 mm',
  ]);
  expect(select.value).toBe('a4');
  act(() => { select.value = size; select.dispatchEvent(new Event('change', { bubbles: true })); });

  const button = [...host.querySelectorAll<HTMLButtonElement>('.studio-actions button')]
    .find(entry => entry.textContent?.startsWith('Export '))!;
  expect(button.disabled).toBe(false);
  await act(async () => button.click());

  expect(exportIssuePdf).toHaveBeenCalledExactlyOnceWith('Test magazine', expect.any(HTMLDivElement), size);
  const exportedRoot = vi.mocked(exportIssuePdf).mock.calls[0][1];
  expect(exportedRoot.querySelectorAll('.page')).toHaveLength(3);
  expect(JSON.stringify(response)).toBe(before);
  // The only server operation is the initial read: choosing an output size
  // must not finalise page numbers or rewrite articles/the saved issue plan.
  expect(issueApi).toHaveBeenCalledTimes(1);
  expect(vi.mocked(issueApi).mock.calls[0][3]).toBe('GET');
});
