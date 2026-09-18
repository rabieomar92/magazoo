import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IssueProof } from './IssueProof';
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

const item = (id: string) => ({ id, name: id.toUpperCase(), doc: presetFor('paper-1') });

it('shows each article through the editor’s own preview, in plan order, around the contents spread', () => {
  const pagesRef = createRef<HTMLDivElement>();
  const documents = [item('a'), item('b')];
  const before = documents.map(entry => JSON.stringify(entry.doc));
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
  // One live editor preview per article — not a copy of one, and not a shared one.
  expect(pagesRef.current!.querySelectorAll('[data-issue-article] .paper-scroll')).toHaveLength(2);
  expect(pagesRef.current!.querySelectorAll('[data-issue-article] .paper-scroll > .pages-frame > .pages')).toHaveLength(2);
  // The export walks `.pages` containers in document order: one per article
  // plus the contents spread, in reading order.
  expect([...pagesRef.current!.querySelectorAll('.pages')].map(node => node.className.includes('issue-proof-contents') ? 'contents' : 'article'))
    .toEqual(['article', 'contents', 'article']);
  expect(host.querySelectorAll('.issue-contents-page')).toHaveLength(2);
  // The contents spread measures before it places, and jsdom has no layout to
  // measure, so the visible columns stay empty here. What this can check is
  // that every entry reached the spread — each one twice, once with its
  // picture and once without, which is how the page works out how many
  // pictures it can afford.
  expect([...host.querySelectorAll('.issue-mosaic-probe [data-variant=photo] [data-contents-id]')]
    .map(node => node.getAttribute('data-contents-id'))).toEqual(['a', 'b']);
  expect([...host.querySelectorAll('.issue-mosaic-probe [data-variant=text] [data-contents-id]')]
    .map(node => node.getAttribute('data-contents-id'))).toEqual(['a', 'b']);
  expect([...host.querySelectorAll('.issue-contents-page')].every(node => node.getAttribute('dir') === 'rtl')).toBe(true);

  render(['b', '__contents__', 'a']);
  expect(articles()).toEqual(['b', 'a']);
  // Issue numbering reaches the page as document data, so nothing writes back
  // into the article the editor owns.
  expect(documents.map(entry => JSON.stringify(entry.doc))).toEqual(before);
});
