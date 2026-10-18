import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { IssueOrder } from './IssueOrder';
import { defaultIssuePlan } from './model';
import { emptyDoc } from '../schema/document';

it('lifts the whole card and cancels without saving a partial move', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const items=['a','b'].map(id=>({id,name:id,version:1,updated:0,doc:emptyDoc()}));
  const change=vi.fn();
  try {
    act(()=>root.render(<IssueOrder visual plan={defaultIssuePlan(items)} items={items} assignments={[]} disabled={false} onChange={change}/>));
    const button=host.querySelector<HTMLButtonElement>('[aria-label="Move a"]')!;
    [...host.querySelectorAll<HTMLElement>('[data-issue-order-id]')].forEach((row,index)=>{
      row.getBoundingClientRect=()=>({left:index*100,right:(index+1)*100,top:0,bottom:100,width:100,height:100,x:index*100,y:0,toJSON:()=>({})});
    });
    button.setPointerCapture=vi.fn();button.hasPointerCapture=()=>false;
    act(()=>button.dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:40,clientY:50,bubbles:true})));
    const overlay=document.querySelector('.issue-drag-preview')!;
    expect(overlay.querySelector('.issue-order-thumb')).not.toBeNull();
    expect(overlay.querySelector('.issue-order-copy')).not.toBeNull();
    expect(overlay.querySelector('[data-issue-order-id]')).toBeNull();
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    act(()=>window.dispatchEvent(new MouseEvent('pointermove',{clientX:250,clientY:50,bubbles:true})));
    expect(host.querySelector<HTMLElement>('[data-issue-order-id="b"]')!.style.transform).toBe('translate(-100px,0px)');
    expect(host.querySelector<HTMLElement>('[data-issue-order-id="a"]')!.style.transform).toBe('translate(100px,0px)');
    expect(change).not.toHaveBeenCalled();
    act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));
    expect(document.querySelector('.issue-drag-preview')).toBeNull();
    expect(host.querySelector<HTMLElement>('[data-issue-order-id="b"]')!.style.transform).toBe('');
    expect(change).not.toHaveBeenCalled();
  } finally {act(()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});

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
