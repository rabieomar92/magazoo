import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IssueProof } from './IssueProof';
import { snapshotIssuePages } from './snapshotIssuePages';
import type { RenderedIssueDocument } from './IssueRenderer';
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

const sheet = (label: string) => {
  const page = document.createElement('section');
  page.className = 'page issue-snapshot';
  page.dataset.sheet = label;
  return page;
};

it('mounts the compiled sheets themselves, in plan order, around the contents spread', () => {
  const pagesRef = createRef<HTMLDivElement>();
  const documents: RenderedIssueDocument[] = [
    { id: 'a', name: 'A', pages: [sheet('a1'), sheet('a2')], pageCount: 2 },
    { id: 'b', name: 'B', pages: [sheet('b1')], pageCount: 1 },
  ];
  const plan: IssuePlan = { order: ['a', '__contents__', 'b'], startNumber: 1, countCovers: false, contentsTitle: 'المحتويات', contentsSubtitle: '', contentsExcluded: [], direction: 'rtl' };
  const entries = [
    { id: 'a', title: 'عنوان', subtitle: 'وصف', page: 1, hero: { src: 'hero.jpg', naturalWidth: 20, naturalHeight: 10 } },
    { id: 'b', title: 'Light', subtitle: 'A discovery', page: 5 },
  ];
  const render = (order = plan.order) => act(() => root.render(
    <IssueProof plan={{ ...plan, order }} entries={entries} documents={documents} magazineName="Magazoo!"
      contentsStart={3} scale={0.5} pagesRef={pagesRef} onOverflow={() => {}} />
  ));

  render();
  const articles = () => [...pagesRef.current!.querySelectorAll('[data-issue-article]')].map(node => node.getAttribute('data-issue-article'));
  expect(articles()).toEqual(['a', 'b']);
  // The sheets on screen are copies of the compiled ones — each article keeps
  // its own `.pages` container, which is the unit the PDF path groups by.
  expect(pagesRef.current!.querySelectorAll('[data-issue-article="a"] > .page')).toHaveLength(2);
  expect(pagesRef.current!.querySelectorAll('[data-issue-article="b"] > .page')).toHaveLength(1);
  expect([...pagesRef.current!.querySelectorAll('[data-issue-article="a"] > .page')].map(node => (node as HTMLElement).dataset.sheet)).toEqual(['a1', 'a2']);
  // The compiler's masters are never handed to the DOM, so a rebuild still has them.
  expect(documents[0].pages.every(page => !page.isConnected)).toBe(true);
  expect(host.querySelectorAll('.issue-contents-page')).toHaveLength(2);
  expect([...host.querySelectorAll('[data-contents-id]')].map(node => node.getAttribute('data-contents-id'))).toEqual(['a', 'b']);
  expect([...host.querySelectorAll('.issue-contents-page')].every(node => node.getAttribute('dir') === 'rtl')).toBe(true);

  render(['b', '__contents__', 'a']);
  expect(articles()).toEqual(['b', 'a']);
  expect(pagesRef.current!.querySelectorAll('[data-issue-article="b"] > .page')).toHaveLength(1);
});
