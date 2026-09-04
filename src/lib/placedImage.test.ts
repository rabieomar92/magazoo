import { describe, expect, it } from 'vitest';
import { emptyDoc, type PlacedImage } from '../schema/document';
import { grid, PAGE_H, PAGE_W } from './geometry';
import { placedImageGeometry, snapImageColumn } from './placedImage';
import { defaultPlacedHighlights, placedHighlightsGeometry } from './placedHighlights';

const image: PlacedImage = {
  id: 'image',
  assetId: 'asset',
  caption: '',
  widthCols: 2,
  anchor: { page: 1, column: 1, y: 40 },
};

describe('placed image geometry', () => {
  it('derives width from whole columns and height from source aspect ratio', () => {
    const design = emptyDoc().design;
    const asset = { src: '', naturalWidth: 800, naturalHeight: 400 };
    const out = placedImageGeometry(image, asset, design);

    expect(out.width).toBeCloseTo(grid(design).span(2));
    expect(out.height).toBeCloseTo(out.width / 2);
    expect(out.left).toBeCloseTo(design.margin + grid(design).col + design.gutter);
  });

  it('clamps the vertical anchor so the image remains on the page', () => {
    const design = emptyDoc().design;
    const out = placedImageGeometry(
      { ...image, anchor: { ...image.anchor, y: 999 } },
      { src: '', naturalWidth: 1000, naturalHeight: 1000 },
      design,
    );
    expect(out.top + out.height).toBeCloseTo(PAGE_H);
  });

  it('snaps to and clamps against valid column starts', () => {
    const design = emptyDoc().design;
    const g = grid(design);
    const secondStart = design.margin + g.col + design.gutter;
    expect(snapImageColumn(secondStart + 1, 2, design)).toBe(1);
    expect(snapImageColumn(999, 2, design)).toBe(g.totalCols - 2);
  });

  it('extends artwork to selected trim edges without changing the column footprint', () => {
    const design = emptyDoc().design;
    const asset = { src: '', naturalWidth: 800, naturalHeight: 400 };
    const out = placedImageGeometry(
      { ...image, bleed: { left: true, right: true, top: true, bottom: true } },
      asset,
      design,
    );

    expect(out.visualLeft).toBe(0);
    expect(out.visualTop).toBe(0);
    expect(out.visualWidth).toBe(PAGE_W);
    expect(out.visualHeight).toBe(PAGE_H);
    expect(out.width).toBeCloseTo(grid(design).span(2));
    expect(out.height).toBeCloseTo(out.width / 2);
    expect(out.captionLeft).toBeCloseTo(out.left);
  });
});

describe('placed highlight geometry', () => {
  it('uses whole-column widths and clamps the content-derived height to the page', () => {
    const design = { ...emptyDoc().design, highlightsPlacement: 'free' as const };
    const placement = defaultPlacedHighlights(design);
    placement.widthCols = 2;
    placement.anchor = { page: 1, column: 99, y: 999 };
    const out = placedHighlightsGeometry(placement, design, 52);

    expect(out.width).toBeCloseTo(grid(design).span(2));
    expect(out.column).toBe(grid(design).totalCols - 2);
    expect(out.top + 52).toBeCloseTo(PAGE_H);
  });
});
