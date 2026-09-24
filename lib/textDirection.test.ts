import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../store/presets';
import { setTextDirection, dropCapEnabled } from './textDirection';
import { cssVars } from './geometry';

describe('all-template Arabic direction',()=>{
  it('preserves existing drop-cap defaults and supports explicit on/off',()=>{
    const d=TEMPLATES[0].make().design;
    expect(dropCapEnabled(d,'paper-1')).toBe(true);
    expect(dropCapEnabled(d,'news-briefs')).toBe(false);
    d.dropCap=false;expect(dropCapEnabled(d,'paper-1')).toBe(false);
    d.dropCap=true;expect(dropCapEnabled(d,'news-briefs')).toBe(true);
  });
  for(const template of TEMPLATES) it(`${template.id} supports RTL without moving physical image anchors`,()=>{
    const d=template.make();const before=JSON.stringify({hero:d.hero,images:d.images,bar:d.design.barSide});
    d.design.bodyAlign='left';
    setTextDirection(d.design,'rtl');
    const vars=cssVars(d.design,d.templateId);
    expect(vars['--text-dir']).toBe('rtl');expect(vars['--body-align']).toBe('right');
    expect(JSON.stringify({hero:d.hero,images:d.images,bar:d.design.barSide})).toBe(before);
    setTextDirection(d.design,'ltr');expect(d.design.bodyAlign).toBe('left');
  });
  it('retains centred and justified typography',()=>{
    const d=TEMPLATES[0].make().design;d.bodyAlign='justify';setTextDirection(d,'rtl');expect(d.bodyAlign).toBe('justify');
    d.bodyAlign='center';setTextDirection(d,'ltr');expect(d.bodyAlign).toBe('center');
  });
});
