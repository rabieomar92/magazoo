import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { paper2VerticalVars } from './paper2';

describe('Physics Letter hero alignment', () => {
  it.each([0, 10, 28])('sits directly under the bar at %s mm while preserving title spacing', offset => {
    const design = { ...emptyDoc().design, topBarOffset: offset, firstPageTopMargin: 55 };
    const vars = paper2VerticalVars(design);
    expect(parseFloat(vars['--p2-start'])).toBe(55);
    expect(parseFloat(vars['--p2-start']) - parseFloat(vars['--p2-hero-lift'])).toBe(offset + 6);
  });
  it('does not lift the copy side when the hero is hidden', () => {
    const vars = paper2VerticalVars({ ...emptyDoc().design, showHero: false, firstPageTopMargin: 40 });
    expect(vars['--p2-hero-lift']).toBe('0mm');
    expect(vars['--p2-start']).toBe('40mm');
  });
  it('meets the top of the page when the bar is hidden, without moving the title', () => {
    const vars = paper2VerticalVars({ ...emptyDoc().design, showTopBar: false, firstPageTopMargin: 45 });
    expect(vars['--p2-start']).toBe('45mm');
    expect(vars['--p2-hero-lift']).toBe('45mm');
  });
  it.each([1,2,3,4] as const)('does not lift the hero into the optional %s-column heading row',headerWidthCols=>{
    expect(paper2VerticalVars({...emptyDoc().design,headerWidthCols,firstPageTopMargin:40})['--p2-hero-lift']).toBe('0mm');
  });
});
