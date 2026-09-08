import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { draggedValue } from './useVerticalDrag';
import { clampGate } from '../lib/gatePlacement';
import { clampSpacing, COVER_STORY_GAP } from '../lib/spacing';
import { presetFor } from '../store/presets';
import { MagGateA, MagGateB } from './MagGate';
import { MagazineFrontCover } from './MagazineFrontCover';

const gate = (value: number) => clampGate(value, 0, 260);

describe('dragging a cover block', () => {
  it('converts pointer travel into page millimetres', () => {
    // A 64% preview of an A4 sheet: 793.7 device pixels across 210mm.
    const pxPerMm = 793.7 / 210;
    expect(draggedValue(116.1, 0, pxPerMm, gate)).toBe(116.1);
    expect(draggedValue(116.1, -113.4, pxPerMm, gate)).toBe(86.1);
    expect(draggedValue(110.6, 94.5, pxPerMm, gate)).toBe(135.6);
    // Zoom cancels out: the same gesture at a different scale moves the same
    // distance on the printed sheet.
    expect(draggedValue(50, 200, 2 * pxPerMm, gate)).toBe(draggedValue(50, 100, pxPerMm, gate));
  });
  it('never leaves the sheet, whatever the gesture', () => {
    const pxPerMm = 3.78;
    expect(draggedValue(20, -10_000, pxPerMm, gate)).toBe(0);
    expect(draggedValue(200, 10_000, pxPerMm, gate)).toBe(260);
    const story = (v: number) => clampSpacing(v, COVER_STORY_GAP, 15);
    expect(draggedValue(15, -10_000, pxPerMm, story)).toBe(COVER_STORY_GAP.min);
    expect(draggedValue(15, 10_000, pxPerMm, story)).toBe(COVER_STORY_GAP.max);
  });
  it('reports the starting value when the sheet has no measurable width', () => {
    expect(draggedValue(42, 500, 0, gate)).toBe(42);
  });
});

describe('cover blocks offer the handle', () => {
  it('marks the gatefold title and facing text as draggable', () => {
    const doc = presetFor('magazine-3');
    expect(renderToStaticMarkup(<MagGateA doc={doc} vars={{}} />)).toContain('mag-gate-mid--draggable');
    expect(renderToStaticMarkup(<MagGateB doc={doc} vars={{}} />)).toContain('mag-gate-mid--draggable');
  });
  it('marks the front cover story block as draggable', () => {
    const doc = presetFor('magazine-4');
    expect(renderToStaticMarkup(<MagazineFrontCover doc={doc} vars={{}} />)).toContain('front-cover-story--draggable');
  });
});
