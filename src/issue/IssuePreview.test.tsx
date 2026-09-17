import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IssuePreview } from './IssuePreview';
import { snapshotIssuePages } from './snapshotIssuePages';
import type { IssuePlan } from './model';
import { presetFor } from '../store/presets';

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

it('places every article through the editor’s own preview, in plan order, without touching the stored documents', () => {
  const pagesRef = createRef<HTMLDivElement>();
  const item = (id: string) => ({ id, name: id.toUpperCase(), version: 1, updated: 0, doc: presetFor('paper-1') });
  const items = [item('a'), item('b')];
  const before = items.map(entry => JSON.stringify(entry.doc));
  const plan: IssuePlan = { order: ['a', '__contents__', 'b'], startNumber: 1, countCovers: false, contentsTitle: 'المحتويات', contentsSubtitle: '', contentsExcluded: [], direction: 'rtl' };
  const entries = [{ id: 'a', title: 'عنوان', subtitle: 'وصف', page: 1, hero: { src: 'hero.jpg', naturalWidth: 20, naturalHeight: 10 } }, { id: 'b', title: 'Light', subtitle: 'A discovery', page: 5 }];
  const assignments = [{ id: 'a', startNumber: 1, pageCount: 2, counted: true }, { id: '__contents__', startNumber: 3, pageCount: 2, counted: true }, { id: 'b', startNumber: 5, pageCount: 1, counted: true }];
  const render = (all: boolean, order = plan.order) => act(() => root.render(<IssuePreview plan={{ ...plan, order }} entries={entries} assignments={assignments} items={items} showAll={all} magazineName="Magazoo!" pagesRef={pagesRef} onOverflow={() => {}} />));

  render(true);
  const articles = () => [...pagesRef.current!.querySelectorAll('[data-issue-article]')].map(node => node.getAttribute('data-issue-article'));
  expect(articles()).toEqual(['a', 'b']);
  // One live preview per article — not a copy of one.
  expect(pagesRef.current!.querySelectorAll('[data-issue-article] .paper-scroll')).toHaveLength(2);
  expect(host.querySelectorAll('.issue-contents-page')).toHaveLength(2);
  expect([...host.querySelectorAll('[data-contents-id]')].map(node => node.getAttribute('data-contents-id'))).toEqual(['a', 'b']);
  expect([...host.querySelectorAll('.issue-contents-page')].every(node => node.getAttribute('dir') === 'rtl')).toBe(true);

  render(true, ['b', '__contents__', 'a']);
  expect(articles()).toEqual(['b', 'a']);
  render(false);
  expect(articles()).toEqual([]);
  expect(host.querySelectorAll('.issue-contents-page')).toHaveLength(2);
  render(true);
  expect(articles()).toEqual(['a', 'b']);
  // Issue numbering reaches the page as document data, so nothing writes back
  // into the article the editor owns.
  expect(items.map(entry => JSON.stringify(entry.doc))).toEqual(before);
});
