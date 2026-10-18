import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { IssueOrder } from './IssueOrder';
import { defaultIssuePlan } from './model';
import { emptyDoc } from '../schema/document';

it('reorders whole articles on the canvas with a keyboard and supports Escape cancellation', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const items = ['a','b'].map(id => ({ id, name: id, version: 1, updated: 0, doc: emptyDoc() }));
  const original = JSON.stringify(items);
  const initial = defaultIssuePlan(items);
  function Check() { const [plan, setPlan] = useState(initial); return <IssueOrder plan={plan} items={items} assignments={[]} disabled={false} onChange={setPlan} visual />; }
  const ids = () => [...host.querySelectorAll('[data-issue-order-id]')].map(node => node.getAttribute('data-issue-order-id'));
  const key = (value: string) => act(() => host.querySelector<HTMLButtonElement>('[aria-label="Move a"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })));
  try {
    act(() => root.render(<Check />));
    expect(host.querySelector('.issue-order-visual')).not.toBeNull();
    key(' '); key('ArrowDown');
    expect(ids().indexOf('a')).toBe(initial.order.indexOf('a') + 1);
    key('Escape'); expect(ids()).toEqual(initial.order);
    key(' '); key('ArrowDown'); key(' ');
    expect(ids().indexOf('a')).toBe(initial.order.indexOf('a') + 1);
    expect(JSON.stringify(items)).toBe(original);
  } finally { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
