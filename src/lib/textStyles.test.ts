import { describe, expect, it } from 'vitest';
import { emptyDoc, migrate } from '../schema/document';
import { cloneDocForUpdate } from '../store/useDoc';
import { extraTextGroups, textStyleSelector, textStylesCss } from './textStyles';
import { presetFor, TEMPLATE_META } from '../store/presets';

describe('component typography',()=>{
  it('keeps older files untouched until a style is explicitly edited',()=>{
    expect(textStylesCss(emptyDoc().design,'scope')).toBe('');
  });
  it('persists independent styles and clones them for undo',()=>{
    const doc=emptyDoc();doc.design.textStyles={title:{fontWeight:700},'block:one':{fontFamily:'Georgia',italic:true,fontSize:12,underline:true,align:'right',lineHeight:1.4,color:'#102030'}};
    const copy=cloneDocForUpdate(doc);copy.design.textStyles!['block:one'].fontSize=20;
    expect(doc.design.textStyles['block:one'].fontSize).toBe(12);
    expect(migrate(JSON.parse(JSON.stringify(doc))).design.textStyles).toEqual(doc.design.textStyles);
    const css=textStylesCss(doc.design,'first');
    for(const declaration of ['font-family:Georgia','font-weight:700','font-style:italic','text-decoration-line:underline','font-size:12pt','line-height:1.4','text-align:right','color:#102030'])expect(css).toContain(declaration);
    expect(css).toContain('[data-source-block-id="one"]');
    expect(css).not.toContain('data-tracking-scope="second"');
  });
  it('places local rules last, bounds numbers, and rejects unsafe imported CSS',()=>{
    const d=emptyDoc().design;
    d.textStyles={'block:one':{fontSize:13},body:{fontSize:9},title:{fontSize:Infinity,fontFamily:'Arial; } body {',color:'red;}'},unknown:{fontSize:16},subtitle:{fontSize:500,lineHeight:-3}};
    const css=textStylesCss(d,'safe');
    expect(css.indexOf('font-size:9pt')).toBeLessThan(css.indexOf('font-size:13pt'));
    expect(css).toContain('font-size:120pt');expect(css).toContain('line-height:0.8');
    expect(css).not.toMatch(/Infinity|Arial;|red;|unknown/);
    expect(textStyleSelector('image-caption:a"]{}')).not.toContain('a"]{}');
  });
  it.each(TEMPLATE_META.map(t=>[t.id]))('provides selectors for extra text groups in %s',id=>{
    for(const {group} of extraTextGroups(presetFor(id)))expect(textStyleSelector(group),group).toBeTruthy();
  });
  it('targets real dedicated cover, front-matter, caption and news nodes',()=>{
    const host=document.createElement('div');
    host.innerHTML='<h1 data-editor-target="front-cover-style-title"></h1><main class="back-cover-brand-block"><h1></h1><h2></h2></main><div class="fm-page fm-page--board"><p class="fm-note-paragraph"></p><p class="fm-board-contact"></p></div><figure data-image-id="one"><figcaption></figcaption></figure><article data-news-id="two"><h2></h2><div class="news-copy"><p></p></div></article>';
    for(const key of ['title','brand','tagline','fmAbout','fmContact','image-caption:one','news:two:title','news:two:body'])expect(host.querySelector(textStyleSelector(key)!)).not.toBeNull();
  });
});
