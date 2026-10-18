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
import { usePdfPreferences } from '../store/pdfPreferences';

const compilation = vi.hoisted(() => ({ sources: vi.fn(), hold: false, complete: undefined as (() => void) | undefined }));
const proofMeasurement=vi.hoisted(()=>({hold:false,complete:undefined as (()=>void)|undefined}));

vi.mock('./api', () => ({ issueApi: vi.fn() }));
vi.mock('../lib/pdfExport', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/pdfExport')>(),
  exportIssuePdf: vi.fn().mockResolvedValue(undefined),
  waitForPreviewResources: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./IssueCompiler', async importOriginal => ({
  ...await importOriginal<typeof import('./IssueCompiler')>(),
  IssueCompiler: ({ sources, items, plan, onComplete }: ComponentProps<typeof Compiler>) => {
    useEffect(() => {
      compilation.sources(sources);
      const counts = Object.fromEntries(items.map(item => [item.id, sources.find(source => source.id === item.id)?.doc.design.pageFormat === 'magazine' ? 2 : 1]));
      const complete = () => onComplete({ numbered: sources, documents: [], counts, assignments: assignIssuePages(plan, items, counts), plan });
      if (compilation.hold) compilation.complete = complete;
      else complete();
    }, [sources, items, plan, onComplete]);
    return null;
  },
}));
vi.mock('./IssueProof', () => ({
  IssueProof: ({ pagesRef, onOverflow, documents, pageSize, onPending, onPageCounts }: ComponentProps<typeof Proof>) => {
    useEffect(() => onOverflow(false), [onOverflow]);
    useEffect(()=>{
      onPending?.();
      const counts=Object.fromEntries(documents.map(source=>[source.id,source.doc.design.pageFormat==='magazine'?2:1]));
      const complete=()=>onPageCounts?.(counts);
      if(proofMeasurement.hold)proofMeasurement.complete=complete;else complete();
    // The real proof measures again when its numbered documents change.
    },[documents]);
    const count = 2 + documents.reduce((total, source) => total + (source.doc.design.pageFormat === 'magazine' ? 2 : 1), 0);
    return <div ref={pagesRef} data-proof-size={pageSize}><div className="pages">{Array.from({ length: count }, (_, index) => <section key={index} className="page" />)}</div></div>;
  },
}));

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let response: IssueResponse;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  usePdfPreferences.setState({ size: 'a4' });
  compilation.hold = false;
  compilation.complete = undefined;
  proofMeasurement.hold=false;proofMeasurement.complete=undefined;
  const items = [{ id: 'article', name: 'A science story', version: 3, updated: 0, doc: emptyDoc() }];
  response = { project: { id: 'project', name: 'Test magazine' }, version: 7, items, plan: defaultIssuePlan(items) };
  vi.mocked(issueApi).mockResolvedValue(response);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('offers canvas-side ordering without replacing the compiled proof', async () => {
  await act(async () => root.render(<IssueWorkspace projectId="project" csrf="test-token" onClose={() => undefined} />));
  const proof = host.querySelector('[data-proof-size]');
  act(() => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Arrange on canvas')!.click());
  expect(host.querySelector('[aria-label="Arrange articles on canvas"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Canvas reading order"] li')).not.toBeNull();
  expect(host.querySelector('[data-proof-size]')).toBe(proof);
  act(() => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'View pages')!.click());
  expect(host.querySelector('[aria-label="Arrange articles on canvas"]')).toBeNull();
});

it('keeps PDF export and the vendor brief disabled until the assembled proof is measured',async()=>{
  proofMeasurement.hold=true;
  await act(async()=>root.render(<IssueWorkspace projectId="project" csrf="test-token" onClose={()=>undefined}/>));
  act(()=>host.querySelector<HTMLButtonElement>('#tab-output')!.click());
  const exportButton=()=>[...host.querySelectorAll<HTMLButtonElement>('.studio-actions button')].find(button=>button.textContent?.startsWith('Export '))!;
  expect(exportButton().disabled).toBe(true);
  expect(host.querySelector<HTMLButtonElement>('.issue-print-brief-button')!.disabled).toBe(true);
  act(()=>proofMeasurement.complete!());
  expect(exportButton().disabled).toBe(false);
  expect(host.querySelector<HTMLButtonElement>('.issue-print-brief-button')!.disabled).toBe(false);
});

it('uses Mosaic for legacy contents layouts without exposing ineffective feature controls', async () => {
  response.plan!.contentsDesign = { layout: 'feature' };
  await act(async () => root.render(<IssueWorkspace projectId="project" csrf="test-token" onClose={() => undefined} />));
  act(() => host.querySelector<HTMLButtonElement>('#tab-contents')!.click());
  expect(host.querySelector('#panel-contents')!.textContent).toContain('Mosaic · tiled cards');
  expect(host.querySelector('#panel-contents')!.textContent).not.toContain('Feature picture (mm)');
  expect(host.querySelector('option[value="feature"]')).toBeNull();
});

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
  expect(exportedRoot.querySelectorAll('.page')).toHaveLength(size === 'magazine' ? 4 : 3);
  expect(exportedRoot.dataset.proofSize).toBe(size);
  const sources = compilation.sources.mock.calls.at(-1)![0];
  expect(sources[0].doc.design.pageFormat).toBe(size);
  expect(JSON.stringify(response)).toBe(before);
  // The only server operation is the initial read: choosing an output size
  // must not finalise page numbers or rewrite articles/the saved issue plan.
  expect(issueApi).toHaveBeenCalledTimes(1);
  expect(vi.mocked(issueApi).mock.calls[0][3]).toBe('GET');
});

it('blocks the old proof until native Magazine recompiles, then restores the legacy composition without writing data', async () => {
  const before = JSON.stringify(response);
  await act(async () => root.render(<IssueWorkspace projectId="project" csrf="test-token" onClose={() => undefined} />));
  act(() => host.querySelector<HTMLButtonElement>('#tab-output')!.click());
  const select = host.querySelector<HTMLSelectElement>('#panel-output select')!;
  const exportButton = () => [...host.querySelectorAll<HTMLButtonElement>('.studio-actions button')].find(button => button.textContent?.startsWith('Export '))!;
  expect(exportButton().disabled).toBe(false);
  compilation.hold = true;
  act(() => { select.value = 'magazine'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(exportButton().disabled).toBe(true);
  expect(host.querySelector('[data-proof-size]')).toBeNull();
  expect(compilation.sources.mock.calls.at(-1)![0][0].doc.design.pageFormat).toBe('magazine');
  act(() => compilation.complete!());
  expect(exportButton().disabled).toBe(false);
  expect(host.querySelector('[data-proof-size]')?.getAttribute('data-proof-size')).toBe('magazine');
  expect(host.querySelector('.inspector-metrics')?.textContent).toContain('4pages');

  compilation.hold = false;
  act(() => { select.value = 'a4'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(exportButton().disabled).toBe(false);
  expect(compilation.sources.mock.calls.at(-1)![0][0].doc.design.pageFormat).toBe('a4');
  expect(host.querySelector('.inspector-metrics')?.textContent).toContain('3pages');
  expect(JSON.stringify(response)).toBe(before);
  expect(issueApi).toHaveBeenCalledTimes(1);
});

it('opens in the shared browser page-size preference without saving the choice to the issue', async () => {
  usePdfPreferences.setState({ size: 'magazine' });
  await act(async () => root.render(<IssueWorkspace projectId="project" csrf="test-token" onClose={() => undefined} />));
  act(() => host.querySelector<HTMLButtonElement>('#tab-output')!.click());
  expect(host.querySelector<HTMLSelectElement>('#panel-output select')!.value).toBe('magazine');
  expect(compilation.sources.mock.calls.at(-1)![0][0].doc.design.pageFormat).toBe('magazine');
  expect(issueApi).toHaveBeenCalledTimes(1);
});
