import { describe, expect, it } from 'vitest';
import { emptyDoc, type PlacedImage } from '../schema/document';
import { grid, PAGE_H, PAGE_W } from './geometry';
import {
  placedImageContour,
  placedImageContourClip,
  placedImageGeometry,
  isPlacedImagePolygonValid,
  placedImagePolygon,
  placedImageControlPoints,
  placedImageWrapGap,
  placedImagePolygonBands,
  placedImagePolygonBandsForRange,
  placedImagePolygonClip,
  MAX_IMAGE_POLYGON_POINTS,
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

describe('shared smooth image borders',()=>{
  const points=[{x:50,y:10},{x:90,y:50},{x:50,y:90},{x:10,y:50}];
  it('preserves old straight outlines but samples a smooth closed curve on request',()=>{
    expect(placedImagePolygon({...image,wrapPolygon:points})).toEqual(points);
    const curved={...image,wrapPolygon:points,wrapSmoothing:1};
    expect(placedImagePolygon(curved)).toHaveLength(256);
    expect(placedImagePolygon(curved)[32]).not.toEqual({x:70,y:30});
    expect(placedImageControlPoints(curved)).toEqual(points);
    expect(placedImagePolygonClip(curved).split(',').length).toBe(257);
    expect(points).toEqual([{x:50,y:10},{x:90,y:50},{x:50,y:90},{x:10,y:50}]);
  });
  it('bounds smoothing and clearance without changing saved/imported values',()=>{
    expect(placedImagePolygon({...image,wrapPolygon:points,wrapSmoothing:NaN})).toEqual(points);
    expect(placedImagePolygon({...image,wrapPolygon:points,wrapSmoothing:50})).toEqual(placedImagePolygon({...image,wrapPolygon:points,wrapSmoothing:1}));
    expect(placedImageWrapGap(image)).toBe(.8);
    expect(placedImageWrapGap({...image,wrapGapMm:0})).toBe(0);
    expect(placedImageWrapGap({...image,wrapGapMm:-3})).toBe(0);
    expect(placedImageWrapGap({...image,wrapGapMm:100})).toBe(12);
    expect(placedImageWrapGap({...image,wrapGapMm:NaN})).toBe(.8);
  });
});

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

describe('freeform placed image boundaries', () => {
  const withPolygon = (wrapPolygon: PlacedImage['wrapPolygon']): PlacedImage => ({
    ...image, wrapShape: 'polygon', wrapPolygon,
  });
  const rectangle = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
  ];
  const concave = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 20 }, { x: 20, y: 20 },
    { x: 20, y: 80 }, { x: 100, y: 80 }, { x: 100, y: 100 }, { x: 0, y: 100 },
  ];

  it('keeps missing, incomplete and collinear imported outlines safely rectangular', () => {
    for (const points of [undefined, [], [{ x: 20, y: 20 }],
      [{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 100, y: 100 }],
      [{ x: NaN, y: 0 }, { x: 0, y: 0 }, { x: Infinity, y: 100 }],
    ]) {
      const input = withPolygon(points);
      expect(isPlacedImagePolygonValid(points)).toBe(false);
      expect(placedImagePolygon(input)).toEqual(rectangle);
      expect(placedImagePolygonBands(input)).toEqual([
        [{ top: 0, bottom: 100 }], [{ top: 0, bottom: 100 }],
      ]);
    }
  });

  it('clamps finite coordinates, removes duplicate closing vertices and never mutates source points', () => {
    const points = [
      { x: -20, y: -1 }, { x: -20, y: -1 }, { x: 120, y: 0 },
      { x: 100, y: 140 }, { x: NaN, y: 1 }, { x: -20, y: -1 },
    ];
    const before = JSON.stringify(points);
    expect(placedImagePolygon(withPolygon(points))).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ]);
    expect(JSON.stringify(points)).toBe(before);
  });

  it('bounds long freehand strokes while retaining a closed usable outline', () => {
    const points = Array.from({ length: 1024 }, (_, index) => ({
      x: 50 + 45 * Math.cos(index * 2 * Math.PI / 1024),
      y: 50 + 45 * Math.sin(index * 2 * Math.PI / 1024),
    }));
    const bounded = placedImagePolygon(withPolygon(points));
    expect(bounded).toHaveLength(MAX_IMAGE_POLYGON_POINTS);
    expect(bounded.every(({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 100)).toBe(true);
    expect(placedImagePolygonBands(withPolygon(points), 4).flat().length).toBe(4);
  });

  it('uses the same even-odd fill in its CSS clip and text-exclusion outline', () => {
    expect(placedImagePolygonClip(withPolygon(rectangle))).toBe(
      'polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%)',
    );
    const input = withPolygon([{ x: 0, y: 0 }, { x: 100, y: 100 },
      { x: 0, y: 100 }, { x: 100, y: 0 }]);
    // A crossing stroke has a zero signed area but is not an empty polygon.
    expect(placedImagePolygon(input)).toHaveLength(4);
    expect(isPlacedImagePolygonValid(input.wrapPolygon)).toBe(true);
    expect(placedImagePolygonBandsForRange(input, 0, 25)).toEqual([
      { top: 0, bottom: 25 }, { top: 75, bottom: 100 },
    ]);
  });

  it('follows a diagonal shape rather than occupying its full bounding rectangle', () => {
    const input = withPolygon([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
    expect(placedImagePolygonBands(input, 4)).toEqual([
      [{ top: 0, bottom: 100 }], [{ top: 25, bottom: 100 }],
      [{ top: 50, bottom: 100 }], [{ top: 75, bottom: 100 }],
    ]);
    expect(placedImagePolygonBandsForRange(input, 40, 60)).toEqual([{ top: 40, bottom: 100 }]);
  });

  it('reclaims the open middle between disconnected lobes within a column', () => {
    const input = withPolygon(concave);
    expect(placedImagePolygonBands(input)).toEqual([
      [{ top: 0, bottom: 100 }], [{ top: 0, bottom: 20 }, { top: 80, bottom: 100 }],
    ]);
    expect(placedImagePolygonBandsForRange(input, 21, 79)).toEqual([
      { top: 0, bottom: 20 }, { top: 80, bottom: 100 },
    ]);
  });

  it('does not reserve untouched columns or merely touching outer boundaries', () => {
    const input = withPolygon([
      { x: 50, y: 20 }, { x: 100, y: 20 }, { x: 100, y: 80 }, { x: 50, y: 80 },
    ]);
    expect(placedImagePolygonBands(input)).toEqual([[], [{ top: 20, bottom: 80 }]]);
    expect(placedImagePolygonBandsForRange(input, 0, 50)).toEqual([]);
  });

  it('maps bleed-aware, unequal physical column ranges and clips ranges outside the frame', () => {
    const input = withPolygon([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
    expect(placedImagePolygonBandsForRange(input, -30, 17)).toEqual([{ top: 0, bottom: 100 }]);
    expect(placedImagePolygonBandsForRange(input, 73, 125)).toEqual([{ top: 73, bottom: 100 }]);
    for (const [left, right] of [[-30, -1], [101, 120], [0, 0], [90, 30], [NaN, 50], [0, Infinity]]) {
      expect(placedImagePolygonBandsForRange(input, left, right)).toEqual([]);
    }
  });

  it('normalises invalid physical column counts', () => {
    expect(placedImagePolygonBands(withPolygon(rectangle), 99)).toHaveLength(4);
    expect(placedImagePolygonBands(withPolygon(rectangle), -1)).toHaveLength(1);
    expect(placedImagePolygonBands(withPolygon(rectangle), NaN)).toHaveLength(1);
  });

  it('does not change the independently placed image footprint, bleed or caption anchor', () => {
    const plain = { ...image, bleed: { left: true, bottom: true }, heightMm: 65 };
    const outlined = { ...plain, wrapShape: 'polygon' as const, wrapPolygon: concave };
    const asset = { src: '', naturalWidth: 800, naturalHeight: 400 };
    const design = emptyDoc().design;
    expect(placedImageGeometry(outlined, asset, design)).toEqual(placedImageGeometry(plain, asset, design));
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
