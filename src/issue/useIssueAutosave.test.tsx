import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useIssueAutosave } from './useIssueAutosave';
import type { IssuePlan } from './model';

const base: IssuePlan = { order: ['__contents__', 'a', 'b'], startNumber: 1, countCovers: false, contentsTitle: 'Contents', contentsSubtitle: '', direction: 'ltr', contentsExcluded: [] };
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let state: ReturnType<typeof useIssueAutosave>;
function Harness({ plan, saved = base }: { plan: IssuePlan; saved?: IssuePlan | null }) {
  state = useIssueAutosave('project', 'csrf', plan, 3, saved);
  return <span>{state.status}</span>;
}
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const render = (plan: IssuePlan) => act(() => root.render(<StrictMode><Harness plan={plan} /></StrictMode>));
it('serializes edits arriving during a save with consecutive optimistic versions', async () => {
  const pending: ((result: Response) => void)[] = [];
  const fetchMock = vi.fn(() => new Promise<Response>(resolve => pending.push(resolve)));
  vi.stubGlobal('fetch', fetchMock);
  render(base);
  render({ ...base, startNumber: 2 });
  await act(() => vi.advanceTimersByTimeAsync(800));
  render({ ...base, startNumber: 3 });
  await act(() => vi.advanceTimersByTimeAsync(800));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => pending.shift()!(new Response(JSON.stringify({ version: 4 }))));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  expect(JSON.parse(calls[0][1].body as string)).toMatchObject({ version: 3, plan: { startNumber: 2 } });
  expect(JSON.parse(calls[1][1].body as string)).toMatchObject({ version: 4, plan: { startNumber: 3 } });
  await act(async () => pending.shift()!(new Response(JSON.stringify({ version: 5 }))));
  expect(state.status).toBe('saved');
  expect(await state.flush()).toBe(5);
});
it('does not falsely report saved or silently overwrite after a conflict', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Changed elsewhere' }), { status: 409 }));
  vi.stubGlobal('fetch', fetchMock);
  render(base); render({ ...base, contentsTitle: 'New title' });
  await act(() => vi.advanceTimersByTimeAsync(1500));
  expect(state.status).toBe('error'); expect(state.error).toBe('Changed elsewhere');
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
