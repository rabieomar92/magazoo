import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { defaultPlacedHighlights, highlightAvoidingTop, placedHighlightsGeometry } from './placedHighlights';

describe('shared highlight geometry', () => {
  it('clamps a box to the actual page height, including reference trim', () => {
    const design=emptyDoc().design;
    const box={widthCols:2 as const,anchor:{page:1,column:99,y:999}};
    expect(placedHighlightsGeometry(box,design,46,276).top).toBe(230);
    expect(placedHighlightsGeometry(box,design,46).top).toBe(251);
    expect(defaultPlacedHighlights({...design,heroHeight:999},276).anchor.y).toBe(276-design.margin);
  });
  it('defaults to native magazine dimensions without requiring a height argument', () => {
    const design = { ...emptyDoc().design, pageFormat: 'magazine' as const, heroHeight: 999 };
    const box = { widthCols: 2 as const, anchor: { page: 1, column: 99, y: 999 } };
    expect(placedHighlightsGeometry(box, design, 46).top).toBe(221);
    expect(defaultPlacedHighlights(design).anchor.y).toBe(267 - design.margin);
    const bounds = placedHighlightsGeometry(box, design, 46);
    expect(bounds.left + bounds.width).toBeCloseTo(203 - design.margin);
  });
  it('merges overlapping exclusion bands without changing the caller’s input', () => {
    const bands=[{top:150,bottom:220},{top:80,bottom:160},{top:0,bottom:25}];
    const before=JSON.stringify(bands);
    expect(highlightAvoidingTop(100,40,276,bands)).toBe(40);
    expect(highlightAvoidingTop(200,40,276,bands)).toBe(220);
    expect(JSON.stringify(bands)).toBe(before);
  });
  it('keeps a valid position and clamps the fallback if no slot can fit', () => {
    expect(highlightAvoidingTop(130,30,276,[{top:0,bottom:100}])).toBe(130);
    expect(highlightAvoidingTop(270,50,276,[{top:0,bottom:276}])).toBe(226);
  });
});
