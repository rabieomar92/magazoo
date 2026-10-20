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

it('preserves caption background alpha in compiled pages without fading the text or covering gallery photos',()=>{
 const source=document.createElement('div');source.className='pages';
 source.innerHTML='<section class="page"><p data-editor-target="meta-hero-caption">Hero caption</p><figure class="g-img"><figcaption data-editor-target="gallery-caption-one"><div class="g-cap"><p>Gallery caption</p></div></figcaption></figure></section>';
 const rules=document.createElement('style');rules.textContent='[data-editor-target="meta-hero-caption"]{background:rgba(0,0,0,.35);color:white}.g-cap{background:rgba(0,0,0,.75)}';
 host.append(rules,source);
 const [copy]=snapshotIssuePages(source,{heroCaption:{backgroundOpacity:35},'gallery-caption:one':{backgroundOpacity:75}});
 rules.remove();
 expect(copy.querySelector<HTMLElement>('.g-cap')!.style.background).toContain('0.75');
 expect(copy.querySelector<HTMLElement>('section>p,p')!.style.background).toContain('0.35');
 expect(copy.querySelector<HTMLElement>('figcaption')!.style.background).toBe('');
 expect(copy.querySelector<HTMLElement>('p')!.style.opacity).toBe('');
});

it('keeps component font overrides after the live article styles and editor targets are removed', () => {
  const source=document.createElement('div');source.className='pages';
  source.innerHTML='<section class="page"><header class="header"><h1 class="title">Title</h1></header><p data-source-block-id="one">Styled <strong>inline emphasis</strong></p><p data-source-block-id="two">Unchanged</p></section>';
  const rules=document.createElement('style');
  rules.textContent='.header .title {font-family: Arial; font-size: 24px; font-style: italic;} p[data-source-block-id="one"] {font-size: 12px; line-height: 18px; font-weight: 700; text-decoration-line: underline; color: #123456; text-align: right;}';
  host.append(rules,source);
  const before=source.outerHTML;
  const [copy]=snapshotIssuePages(source,{title:{fontFamily:'Arial',fontSize:18,italic:true},'block:one':{fontSize:9,lineHeight:1.5,fontWeight:700,underline:true,color:'#123456',align:'right'}});
  rules.remove();source.remove();host.append(copy);
  const title=copy.querySelector('h1')!, paragraph=copy.querySelector('p')!;
  expect(title.style.fontFamily).toBe('Arial');expect(title.style.fontStyle).toBe('italic');
  expect(title.style.fontSize).toBe('24px');
  expect(paragraph.style.fontWeight).toBe('700');expect(paragraph.style.lineHeight).toBe('1.5');
  expect(paragraph.style.textDecorationLine).toBe('underline');expect(paragraph.style.textAlign).toBe('right');
  expect(paragraph.style.color).toBe('rgb(18, 52, 86)');
  expect(paragraph.style.getPropertyPriority('font-weight')).toBe('important');
  expect(copy.querySelectorAll('p')[1].style.fontWeight).toBe('');
  expect(copy.querySelector('[data-source-block-id]')).toBeNull();
  expect(source.outerHTML).toBe(before);
});

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
  for (const preview of pagesRef.current!.querySelectorAll('.paper-scroll')) {
    expect(preview.hasAttribute('inert')).toBe(false);
    expect(preview.classList.contains('paper-scroll--readonly')).toBe(true);
    expect(preview.getAttribute('role')).toBe('region');
    expect(preview.getAttribute('tabindex')).toBe('0');
  }
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

it('passes the native Magazine size through to both generated contents pages', () => {
  const pagesRef = createRef<HTMLDivElement>();
  const plan: IssuePlan = { order: ['__contents__'], startNumber: 1, countCovers: false, contentsTitle: 'Contents', contentsSubtitle: '', contentsExcluded: [], direction: 'ltr' };
  act(() => root.render(<IssueProof plan={plan} entries={[]} documents={[]} magazineName="Magazoo!" contentsStart={1}
    pageSize="magazine" scale={0.5} pagesRef={pagesRef} onOverflow={() => {}} />));
  const pages = [...pagesRef.current!.querySelectorAll<HTMLElement>('.issue-contents-page')];
  expect(pages).toHaveLength(2);
  expect(pages.map(page => [page.style.getPropertyValue('--page-w'), page.style.getPropertyValue('--page-h')]))
    .toEqual([['203mm', '267mm'], ['203mm', '267mm']]);
});

it('shows project trim guides on both contents pages without adding them to article pages twice',()=>{
 const pagesRef=createRef<HTMLDivElement>();
 const plan:IssuePlan={order:['__contents__'],startNumber:1,countCovers:false,contentsTitle:'Contents',contentsSubtitle:'',contentsExcluded:[],direction:'ltr'};
 act(()=>root.render(<IssueProof plan={plan} entries={[]} documents={[]} magazineName="Test" contentsStart={1} pageSize="jis-b5" bleedMm={5} scale={.5} pagesRef={pagesRef} onOverflow={()=>{}}/>));
 const pages=[...host.querySelectorAll<HTMLElement>('.issue-contents-page')];
 expect(pages).toHaveLength(2);
 for(const page of pages){
  expect(page.dataset.canvasBleedMm).toBe('5');
  expect(page.querySelectorAll('.canvas-trim-corners line')).toHaveLength(8);
  expect(page.querySelector<SVGElement>('.canvas-trim-corners')?.getAttribute('viewBox')).toBe('0 0 192 267');
 }
});
