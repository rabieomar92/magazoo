import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IssuePreview } from './IssuePreview';
import { snapshotIssuePages } from './snapshotIssuePages';
import type { IssuePlan } from './model';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('copies only physical pages and preserves each article’s design without editing its source', () => {
  const source = document.createElement('div');
  source.className = 'pages pages--rtl drop-caps-off'; source.lang = 'ar';
  source.style.transform = 'scale(0.4)';
  source.innerHTML = '<section class="page gallery" style="--ink: #123456; display:grid; direction:rtl"><b data-editor-target="title" contenteditable="true" tabindex="0">عنوان</b></section><div class="measure"><div class="page">Not a sheet</div></div>';
  host.append(source);
  const original = source.outerHTML;
  const [copy, ...remaining] = snapshotIssuePages(source);
  expect(remaining).toHaveLength(0);
  expect(copy.style.getPropertyValue('--ink')).toBe('#123456');
  expect(copy.style.display).toBe('grid');
  expect(copy.style.direction).toBe('rtl');
  expect(copy.classList.contains('pages--rtl')).toBe(true);
  expect(copy.classList.contains('drop-caps-off')).toBe(true);
  expect(copy.lang).toBe('ar');
  expect(copy.querySelector('[contenteditable],[data-editor-target]')).toBeNull();
  expect(source.outerHTML).toBe(original);
});

it('keeps exactly two contents pages and each article sheet once across rearrangements and view changes', () => {
  const pagesRef = createRef<HTMLDivElement>();
  const makePage = (number: number) => {
    const node = document.createElement('section'); node.className = 'page';
    node.innerHTML = `<footer class="page-folio"><b class="page-folio-number">${number}</b></footer>`;
    return node;
  };
  const a = { id: 'a', name: 'A', pageCount: 2, pages: [makePage(91), makePage(92)] };
  const b = { id: 'b', name: 'B', pageCount: 1, pages: [makePage(61)] };
  const original = a.pages.map(page => page.outerHTML);
  const plan: IssuePlan = { order: ['a', '__contents__', 'b'], startNumber: 1, countCovers: false, contentsTitle: 'المحتويات', contentsSubtitle: '', contentsExcluded: [], direction: 'rtl' };
  const entries = [{ id: 'a', title: 'عنوان', subtitle: 'وصف', page: 1, hero: 'hero.jpg' }, { id: 'b', title: 'Light', subtitle: 'A discovery', page: 5 }];
  const assignments = [{ id: 'a', startNumber: 1, pageCount: 2, counted: true }, { id: '__contents__', startNumber: 3, pageCount: 2, counted: true }, { id: 'b', startNumber: 5, pageCount: 1, counted: true }];
  const render = (all: boolean, order = plan.order) => act(() => root.render(<IssuePreview plan={{ ...plan, order }} entries={entries} assignments={assignments} rendered={[a, b]} showAll={all} magazineName="Magazoo!" pagesRef={pagesRef} onOverflow={() => {}} />));
  render(true);
  expect(pagesRef.current!.children).toHaveLength(5);
  expect(host.querySelectorAll('.issue-contents-page')).toHaveLength(2);
  expect([...host.querySelectorAll('[data-contents-id]')].map(node => node.getAttribute('data-contents-id'))).toEqual(['a', 'b']);
  expect([...host.querySelectorAll('.issue-contents-page')].every(node => node.getAttribute('dir') === 'rtl')).toBe(true);
  expect([...host.querySelectorAll('.page-folio-number')].map(node => node.textContent)).toEqual(['1', '2', '5']);
  render(true, ['b', '__contents__', 'a']);
  expect([...pagesRef.current!.children].map(node => node.getAttribute('data-issue-article'))).toEqual(['b', null, null, 'a', 'a']);
  render(false); expect(pagesRef.current!.children).toHaveLength(2);
  render(true); expect(pagesRef.current!.children).toHaveLength(5);
  expect(a.pages.map(page => page.outerHTML)).toEqual(original);
});
