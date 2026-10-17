import { describe, expect, it } from 'vitest';
import { emptyDoc, migrate } from '../schema/document';
import { cloneDocForUpdate } from '../store/useDoc';
import { extraTextGroups, textStyleSelector, textStylesCss } from './textStyles';
import { presetFor, TEMPLATE_META } from '../store/presets';

describe('component typography',()=>{
  it.each(TEMPLATE_META.map(t=>[t.id]))('%s gives native object controls precedence over shared defaults in the same print-safe cascade',id=>{
    const doc=presetFor(id);doc.design.textStyles={body:{align:'left',fontSize:9,color:'#111111'},subtitle:{align:'left'},'block:one':{fontFamily:'Georgia'}};
    doc.blocks=[{id:'one',type:'paragraph',text:'Preserve this copy',align:'justify',fontSize:13,color:'#224466'}];
    const before=JSON.stringify(doc),css=textStylesCss(doc.design,'audit',doc.blocks);
    const rule=css.split('\n').find(line=>line.includes('data-source-block-id="one"'))!;
    for(const property of ['text-align:justify !important','font-size:13pt !important','color:#224466 !important','font-family:Georgia'])expect(rule).toContain(property);
    expect(css.indexOf('text-align:left')).toBeLessThan(css.indexOf('text-align:justify'));
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('retains explicit local overrides and gallery-caption alignment without touching authored data',()=>{
    const doc=emptyDoc();doc.blocks=[{id:'p',type:'paragraph',text:'Text',align:'center'},{id:'f',type:'figure',assetId:'a',span:1,caption:'Caption',captionAlign:'justify'}];
    doc.design.textStyles={'block:p':{align:'right'},subtitle:{align:'left'}};
    const css=textStylesCss(doc.design,'audit',doc.blocks);
    expect(css.split('\n').find(line=>line.includes('data-source-block-id="p"'))).toContain('text-align:right !important');
    expect(css.split('\n').find(line=>line.includes('gallery-caption-f'))).toContain('text-align:justify !important');
  });
  it('inherits an individual news headline font only within its own story',()=>{
    const design=emptyDoc().design;design.textStyles={'news:story-one:title':{fontFamily:'Helvetica'},'news:story-two:body':{fontFamily:'Arial'}};
    const css=textStylesCss(design,'proof');
    expect(css).toContain('[data-tracking-scope="proof"] [data-news-id="story-one"] { --drop-cap-font:Helvetica, Arial, sans-serif; }');
    expect(css.match(/--drop-cap-font/g)).toHaveLength(1);
  });
  it('keeps older files untouched until a style is explicitly edited',()=>{
    expect(textStylesCss(emptyDoc().design,'scope')).toBe('');
  });
  it('gives explicitly aligned cover text a usable frame without changing legacy defaults',()=>{
    const d=emptyDoc().design;
    d.textStyles={brand:{align:'right'},socialUrl:{align:'center'}};
    const css=textStylesCss(d,'cover');
    expect(css).toContain('align-self:stretch !important;width:100% !important');
    expect(css).toContain('.back-cover-social-copy { flex:1; }');
    d.textStyles={brand:{fontSize:24}};
    expect(textStylesCss(d,'cover')).not.toContain('align-self');
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
  it('targets every editorial quote and attribution without styling their layout containers',()=>{
    const host=document.createElement('div');
    host.innerHTML=['mag','mag2','mag-gate'].map(prefix=>`<blockquote class="${prefix}-quote"><span class="${prefix}-quote-text">Quote</span><cite class="${prefix}-quote-by">Author</cite></blockquote>`).join('');
    expect(host.querySelectorAll(textStyleSelector('quote')!)).toHaveLength(3);
    expect(host.querySelectorAll(textStyleSelector('attribution')!)).toHaveLength(3);
    for(const node of host.querySelectorAll(textStyleSelector('quote')!))expect(node.tagName).toBe('SPAN');
  });
});
