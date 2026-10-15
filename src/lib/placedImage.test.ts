import { describe, expect, it } from 'vitest';
import { emptyDoc, type PlacedImage } from '../schema/document';
import { grid, PAGE_H, PAGE_W } from './geometry';
import {
  placedImageContour,
  placedImageContourClip,
  placedImageGeometry,
  snapImageColumn,
} from './placedImage';
import { defaultPlacedHighlights, placedHighlightsGeometry } from './placedHighlights';

const image: PlacedImage = {
  id: 'image',
  assetId: 'asset',
  caption: '',
  widthCols: 2,
  anchor: { page: 1, column: 1, y: 40 },
};

describe('placed image geometry', () => {
  it('changes height independently of column width and retains crop settings', () => {
    const design = emptyDoc().design;
    const asset = { src: '', naturalWidth: 800, naturalHeight: 400 };
    for (const heightMm of [1, 42.3, 180, PAGE_H]) {
      const out = placedImageGeometry({ ...image, heightMm }, asset, design);
      expect(out.height).toBe(heightMm);
      expect(out.width).toBeCloseTo(grid(design).span(2));
      expect(out.top + out.height).toBeLessThanOrEqual(PAGE_H);
      expect(out.visualHeight).toBe(heightMm);
    }
  });

  it('bounds explicit heights to the actual composition and ignores invalid overrides', () => {
    const design = emptyDoc().design;
    const asset = { src: '', naturalWidth: 800, naturalHeight: 400 };
    expect(placedImageGeometry({ ...image, heightMm: 999 }, asset, design, 276).height).toBe(276);
    expect(placedImageGeometry({ ...image, heightMm: .1 }, asset, design).height).toBe(1);
    for (const heightMm of [undefined, 0, -20, NaN, Infinity]) {
      expect(placedImageGeometry({ ...image, heightMm }, asset, design).height).toBeCloseTo(grid(design).span(2) / 2);
    }
  });

  it('extends an explicitly sized image only when bleed is deliberately enabled', () => {
    const design = emptyDoc().design;
    const asset = { src: '', naturalWidth: 800, naturalHeight: 400 };
    const out = placedImageGeometry({ ...image, heightMm: 80, bleed: { bottom: true } }, asset, design);
    expect(out.height).toBe(80);
    expect(out.visualTop + out.visualHeight).toBe(PAGE_H);
  });

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

  it('normalises a custom contour without changing the image geometry', () => {
    const contoured: PlacedImage = {
      ...image,
      wrapShape: 'contour',
      wrapContour: { top: [0, 30], bottom: [10, 90] },
    };

    expect(placedImageContour(contoured)).toEqual([
      { top: 0, bottom: 10 },
      { top: 30, bottom: 62 },
    ]);
    expect(placedImageContourClip({
      ...contoured,
      wrapContour: { top: [0, 30], bottom: [10, 0] },
    })).toBe(
      'polygon(0% 0%, 50% 0%, 50% 30%, 100% 30%, 100% 100%, 50% 100%, 50% 90%, 0% 90%)',
    );
  });

  it('uses native magazine bounds for default height limits, column widths and edge bleeds', () => {
    const design = { ...emptyDoc().design, pageFormat: 'magazine' as const };
    const asset = { src: '', naturalWidth: 800, naturalHeight: 400 };
    const before = JSON.stringify(design);
    const out = placedImageGeometry({ ...image, heightMm: 999,
      bleed: { left: true, right: true, top: true, bottom: true } }, asset, design);
    expect(out.width).toBeCloseTo(grid(design).span(2));
    expect(out.height).toBe(267);
    expect(out.top).toBe(0);
    expect(out.visualWidth).toBe(203);
    expect(out.visualHeight).toBe(267);
    expect(JSON.stringify(design)).toBe(before);
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
