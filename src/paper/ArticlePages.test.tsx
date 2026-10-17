import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ARTICLE_LAYOUTS, type ReferenceArticleId } from '../lib/articleLayouts';
import { cssVars } from '../lib/geometry';
import { presetFor } from '../store/presets';
import { ArticlePages } from './ArticlePages';

describe('native article sheet markup', () => {
  it.each(Object.keys(ARTICLE_LAYOUTS) as ReferenceArticleId[])('%s omits blank subtitles without modifying the authored document',template=>{
    for(const subtitle of ['', '  \n  ']){
      const doc=presetFor(template);doc.meta.subtitle=subtitle;
      const before=JSON.stringify(doc);
      const html=renderToStaticMarkup(<ArticlePages doc={doc} vars={cssVars(doc.design,template)} onStatus={()=>{}} readOnly/>);
      const host=document.createElement('div');host.innerHTML=html;
      expect(host.querySelector('.article-header .subtitle')).toBeNull();
      expect(JSON.stringify(doc)).toBe(before);
    }
  });
  it.each(Object.keys(ARTICLE_LAYOUTS) as ReferenceArticleId[])('%s marks the actual magazine trim on visible and measuring frames', template => {
    const doc = presetFor(template);
    doc.design.pageFormat = 'magazine';
    const before = JSON.stringify(doc);
    const html = renderToStaticMarkup(<ArticlePages doc={doc} vars={cssVars(doc.design, template)} onStatus={() => {}} readOnly />);
    expect(html).toContain('data-page-width-mm="203"');
    expect(html).toContain('data-page-height-mm="267"');
    expect(html).toContain('--page-w:203mm');
    expect(html).toContain('--page-h:267mm');
    expect(html).not.toContain('width:210mm');
    expect(JSON.stringify(doc)).toBe(before);
  });
  it.each(Object.keys(ARTICLE_LAYOUTS) as ReferenceArticleId[])('%s renders optional bottom bleed with its caption inside the photograph', template => {
    const doc = presetFor(template);
    doc.design.heroAtBottom = true;
    doc.design.heroBottomBleed = true;
    doc.design.pageFormat = 'magazine';
    doc.meta.heroCaption = 'Keep the original caption visible inside the image.';
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<ArticlePages doc={doc} vars={cssVars(doc.design, template)} onStatus={() => {}} readOnly />);
    const page = host.querySelector<HTMLElement>('.article-page')!;
    const photo = page.querySelector<HTMLElement>('.article-hero')!;
    expect(page.classList.contains('page--hero-bottom-bleed')).toBe(true);
    expect(parseFloat(photo.style.top) + parseFloat(photo.style.height)).toBe(267);
    expect(photo.classList.contains('article-hero--bottom-bleed')).toBe(true);
    expect(photo.querySelector('figcaption')?.textContent).toBe(doc.meta.heroCaption);
    expect(photo.querySelector('img')?.getAttribute('data-image-fit')).toBe('cover');
    expect(page.querySelector('.article-inset-caption')).toBeNull();
  });
});
