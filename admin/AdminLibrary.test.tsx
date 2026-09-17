import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminLibrary from './AdminLibrary';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const projects = [{ id: 'p', name: 'Physics', items: Array.from({ length: 23 }, (_, i) => ({ id: String(i), name: `story-${i}.json`, token: String(i), version: 1, updated: 0 })) }, { id: 'empty', name: 'Empty project', items: [] }];
const props = { busy: false, onDelete: vi.fn(), onCopy: vi.fn(), link: (token: string) => `#edit=${token}` };
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = (data = projects) => act(() => root.render(<AdminLibrary {...props} projects={data} />));
const click = (text: string) => act(() => (Array.from(host.querySelectorAll('button')).find(b => b.textContent === text)!).click());
it('bounds results and navigates pages, including empty projects', () => {
  render(); expect(host.querySelectorAll('li')).toHaveLength(10);
  click('Next'); expect(host.textContent).toContain('Page 2 of 3');
  click('Next'); expect(host.querySelectorAll('li')).toHaveLength(3); expect(host.textContent).toContain('Empty project');
  render([{ ...projects[0], items: projects[0].items.slice(0, 2) }]);
  expect(host.textContent).toContain('Page 1 of 1'); expect(host.querySelectorAll('li')).toHaveLength(2);
});
it('searches filenames across all pages and clears filters', () => {
  render(); click('Next');
  const input = host.querySelector('input')!;
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'STORY-22'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(host.querySelectorAll('li')).toHaveLength(1); expect(host.textContent).toContain('story-22.json'); expect(host.textContent).toContain('Page 1 of 1');
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'missing'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(host.textContent).toContain('No matching documents'); click('Clear filters'); expect(host.querySelectorAll('li')).toHaveLength(10);
});
