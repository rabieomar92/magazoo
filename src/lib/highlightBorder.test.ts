import {describe,it,expect} from 'vitest';
import {emptyDoc,migrate} from '../schema/document';
import {highlightBorderEnabled,highlightBorderVars} from './highlightBorder';
import {cssVars} from './geometry';
import {TEMPLATE_META} from '../store/presets';
describe('highlight border appearance',()=>{
  it('retains legacy default appearances, including the unbordered Particle Feature',()=>{
    const d=emptyDoc().design;
    expect(highlightBorderEnabled(d,'paper-8')).toBe(true);expect(highlightBorderEnabled(d,'magazine-2')).toBe(false);
    expect(highlightBorderVars(d)).toEqual({'--hl-border-color':'var(--accent)','--mag2-hl-border':'0 solid transparent'});
  });
  it.each(TEMPLATE_META.map(meta=>meta.id))('shares explicit coloured/hidden border variables in %s',template=>{
    const d=emptyDoc().design;d.highlightBorder=true;d.highlightBorderColor='#c62475';
    expect(highlightBorderEnabled(d,template)).toBe(true);expect(cssVars(d,template)['--hl-border-color']).toBe('#c62475');
    expect(cssVars(d,template)['--mag2-hl-border']).toBe('1px solid #c62475');
    d.highlightBorder=false;expect(highlightBorderEnabled(d,template)).toBe(false);expect(cssVars(d,template)['--hl-border-color']).toBe('transparent');
    expect(d.highlightBorderColor).toBe('#c62475');
  });
  it('preserves the appearance settings on JSON round trip without altering any publication copy',()=>{
    const doc=emptyDoc();doc.design.highlightBorder=false;doc.design.highlightBorderColor='#42a5c7';
    const restored=migrate(JSON.parse(JSON.stringify(doc)));
    expect(restored.design.highlightBorder).toBe(false);expect(restored.design.highlightBorderColor).toBe('#42a5c7');expect(restored.meta).toEqual(doc.meta);expect(restored.blocks).toEqual(doc.blocks);
    expect(highlightBorderVars({...doc.design,highlightBorder:true,highlightBorderColor:'url(unsafe)'} )['--hl-border-color']).toBe('var(--accent)');
  });
});
