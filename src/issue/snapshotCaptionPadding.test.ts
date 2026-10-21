import {expect,it,vi} from 'vitest';
vi.mock('../lib/pdfExport',()=>({clonePages:(source:HTMLElement,staging:Document)=>{const pages=staging.createElement('div');pages.className='pdf-export-pages';for(const child of source.children)pages.append(child.cloneNode(true));staging.body.append(pages);}}));
import {snapshotIssuePages} from './snapshotIssuePages';
it.each(['tight','padded'] as const)('preserves %s caption spacing when a compiled article is detached',captionPadding=>{
 const source=document.createElement('div');source.innerHTML='<section class="page"><div class="article-hero-caption" data-editor-target="meta-hero-caption">Caption</div></section>';
 const caption=source.querySelector<HTMLElement>('.article-hero-caption')!;
 caption.style.padding=captionPadding==='tight'?'0px':'10px 12px';
 caption.style.setProperty('--caption-padding-block',captionPadding==='tight'?'0mm':'2.5mm');
 caption.style.setProperty('--caption-padding-inline',captionPadding==='tight'?'0mm':'3mm');
 document.body.append(source);
 try{
  const [page]=snapshotIssuePages(source,{heroCaption:{captionPadding}});
  const saved=page.querySelector<HTMLElement>('.article-hero-caption')!;
  expect(saved.style.padding).toBe(caption.style.padding);
  expect(saved.style.getPropertyPriority('padding')).toBe('important');
  expect(saved.style.getPropertyValue('--caption-padding-block')).toBe(captionPadding==='tight'?'0mm':'2.5mm');
 }finally{source.remove();}
});
