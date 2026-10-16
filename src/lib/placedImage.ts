import type { Asset, Design, PlacedImage } from '../schema/document';
import { grid } from './geometry';
import { pageDimensions } from './pageFormat';

export interface PlacedImageGeometry {
  column: number;
  widthCols: number;
  left: number;
  top: number;
  width: number;
  height: number;
  maxTop: number;
  visualLeft: number;
  visualTop: number;
  visualWidth: number;
  visualHeight: number;
  captionLeft: number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export const MAX_CONTOUR_INSET = 85;
export const MAX_COMBINED_CONTOUR_INSET = 92;

export interface PlacedImageContourSlice {
  top: number;
  bottom: number;
}

export interface PlacedImagePolygonPoint {
  x: number;
  y: number;
}

/** Occupied vertical coordinates, in percent of the visible image frame.
 * Unlike legacy contour slices, `bottom` is a coordinate, not an inset. */
export interface PlacedImagePolygonBand {
  top: number;
  bottom: number;
}

export const MAX_IMAGE_POLYGON_POINTS = 128;
const POLYGON_EPSILON = 1e-7;
const rectanglePolygon = (): PlacedImagePolygonPoint[] => [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
];

/** Bound imported/drawn outlines without mutating the document. Incomplete or
 * degenerate paths stay rectangular so they cannot silently expose artwork to
 * overlapping text. Self-crossing paths are valid: both consumers use even-odd
 * filling, matching a freehand outline drawn back across itself. */
function normalisedImagePolygon(raw: PlacedImage['wrapPolygon']): PlacedImagePolygonPoint[] {
  if (!Array.isArray(raw)) return [];
  const points: PlacedImagePolygonPoint[] = [];
  for (const point of raw) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const current = { x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 100) };
    const previous = points[points.length - 1];
    if (!previous || Math.abs(previous.x - current.x) > POLYGON_EPSILON ||
      Math.abs(previous.y - current.y) > POLYGON_EPSILON) points.push(current);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && points.length > 1 &&
    Math.abs(first.x - last.x) <= POLYGON_EPSILON &&
    Math.abs(first.y - last.y) <= POLYGON_EPSILON) points.pop();
  if (points.length < 3) return [];
  const bounded = points.length > MAX_IMAGE_POLYGON_POINTS
    ? Array.from({ length: MAX_IMAGE_POLYGON_POINTS }, (_, index) =>
      points[Math.floor(index * points.length / MAX_IMAGE_POLYGON_POINTS)])
    : points;
  const origin = bounded[0];
  const next = bounded.find((point) => Math.abs(point.x - origin.x) > POLYGON_EPSILON ||
    Math.abs(point.y - origin.y) > POLYGON_EPSILON);
  if (!next || !bounded.some((point) => Math.abs(
    (next.x - origin.x) * (point.y - origin.y) -
    (next.y - origin.y) * (point.x - origin.x),
  ) > POLYGON_EPSILON)) return [];
  return bounded;
}

/** The drawing UI uses this before applying a path; a self-crossing outline is
 * valid, but fewer than three distinct non-collinear bounded points are not. */
export function isPlacedImagePolygonValid(points: PlacedImage['wrapPolygon']): boolean {
  return normalisedImagePolygon(points).length >= 3;
}

export function placedImageControlPoints(image: PlacedImage): PlacedImagePolygonPoint[] {
  const points = normalisedImagePolygon(image.wrapPolygon);
  return points.length >= 3 ? points : rectanglePolygon();
}

export function placedImageWrapGap(image:PlacedImage):number {
  return Number.isFinite(image.wrapGapMm) ? clamp(image.wrapGapMm!,0,12) : .8;
}

/** One closed sampled curve is shared by the crop, editor and line wrapping.
 * Keeping raw handles separate means editing never repeatedly smooths a path. */
export function placedImagePolygon(image: PlacedImage): PlacedImagePolygonPoint[] {
  const points=placedImageControlPoints(image);
  const smoothing=Number.isFinite(image.wrapSmoothing)?clamp(image.wrapSmoothing!,0,1):0;
  if(!smoothing)return points;
  const steps=Math.max(2,Math.floor(256/points.length));
  return points.flatMap((p1,i)=>{
    const p0=points[(i+points.length-1)%points.length],p2=points[(i+1)%points.length],p3=points[(i+2)%points.length];
    return Array.from({length:steps},(_,j)=>{
      const t=j/steps,t2=t*t,t3=t2*t;
      const coordinate=(key:'x'|'y')=>{
        const linear=p1[key]+(p2[key]-p1[key])*t;
        const curve=.5*(2*p1[key]+(-p0[key]+p2[key])*t+(2*p0[key]-5*p1[key]+4*p2[key]-p3[key])*t2+(-p0[key]+3*p1[key]-3*p2[key]+p3[key])*t3);
        return clamp(linear+(curve-linear)*smoothing,0,100);
      };
      return {x:coordinate('x'),y:coordinate('y')};
    });
  });
}

/** Clip the source itself to exactly the outline used for text exclusion. */
export function placedImagePolygonClip(image: PlacedImage): string {
  const coordinate = (value: number) => Number(value.toFixed(6));
  return `polygon(evenodd, ${placedImagePolygon(image)
    .map(({ x, y }) => `${coordinate(x)}% ${coordinate(y)}%`).join(', ')})`;
}

function polygonBandsForRange(
  points: PlacedImagePolygonPoint[], left: number, right: number,
): PlacedImagePolygonBand[] {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return [];
  left = clamp(left, 0, 100);
  right = clamp(right, 0, 100);
  if (right - left <= POLYGON_EPSILON) return [];
  const events = points.map(({ y }) => y);
  const edges = points.map((start, index) => ({ start, end: points[(index + 1) % points.length] }));
  for (const { start, end } of edges) {
    const dx = end.x - start.x;
    if (Math.abs(dx) <= POLYGON_EPSILON) continue;
    for (const boundary of [left, right]) {
      const t = (boundary - start.x) / dx;
      if (t > 0 && t < 1) events.push(start.y + t * (end.y - start.y));
    }
  }
  // Edge crossings are events too; omitting them could miss a narrow occupied
  // band when an author draws a self-intersecting outline.
  for (let a = 0; a < edges.length; a += 1) {
    const first = edges[a];
    const ax = first.end.x - first.start.x;
    const ay = first.end.y - first.start.y;
    for (let b = a + 1; b < edges.length; b += 1) {
      const second = edges[b];
      const bx = second.end.x - second.start.x;
      const by = second.end.y - second.start.y;
      const cross = ax * by - ay * bx;
      if (Math.abs(cross) <= POLYGON_EPSILON) continue;
      const dx = second.start.x - first.start.x;
      const dy = second.start.y - first.start.y;
      const t = (dx * by - dy * bx) / cross;
      const u = (dx * ay - dy * ax) / cross;
      if (t > 0 && t < 1 && u > 0 && u < 1) events.push(first.start.y + t * ay);
    }
  }
  const levels = events.sort((a, b) => a - b)
    .filter((value, index, sorted) => index === 0 || value - sorted[index - 1] > POLYGON_EPSILON);
  const bands: PlacedImagePolygonBand[] = [];
  for (let index = 0; index < levels.length - 1; index += 1) {
    const top = levels[index];
    const bottom = levels[index + 1];
    const y = (top + bottom) / 2;
    const crossings: number[] = [];
    for (const { start, end } of edges) {
      if ((start.y > y) !== (end.y > y)) {
        crossings.push(start.x + (y - start.y) * (end.x - start.x) / (end.y - start.y));
      }
    }
    crossings.sort((a, b) => a - b);
    let occupied = false;
    for (let crossing = 0; crossing + 1 < crossings.length; crossing += 2) {
      if (Math.min(right, crossings[crossing + 1]) - Math.max(left, crossings[crossing]) > POLYGON_EPSILON) {
        occupied = true;
        break;
      }
    }
    if (!occupied) continue;
    const previous = bands[bands.length - 1];
    if (previous && top - previous.bottom <= POLYGON_EPSILON) previous.bottom = bottom;
    else bands.push({ top, bottom });
  }
  return bands;
}

/** Project the filled outline through an actual physical text-column range.
 * Inputs are percentages of the visible image width, so callers can account
 * exactly for column gutters and edge bleed. Disconnected lobes remain separate
 * bands; a concave outline need not block the empty space between them. Ranges
 * beyond the image, empty/reversed ranges and non-finite ranges occupy nothing. */
export function placedImagePolygonBandsForRange(
  image: PlacedImage, leftPercent: number, rightPercent: number,
): PlacedImagePolygonBand[] {
  return polygonBandsForRange(placedImagePolygon(image), leftPercent, rightPercent);
}

/** Convenience projection for evenly divided occupied physical columns. */
export function placedImagePolygonBands(
  image: PlacedImage, count: number = image.widthCols,
): PlacedImagePolygonBand[][] {
  const columns = clamp(Number.isFinite(count) ? Math.round(count) : 1, 1, 4);
  const points = placedImagePolygon(image);
  return Array.from({ length: columns }, (_, index) =>
    polygonBandsForRange(points, index * 100 / columns, (index + 1) * 100 / columns));
}

/** Normalise an image's author-drawn contour into one safe slice per occupied
 * physical column. Old documents have no contour and therefore remain boxes. */
export function placedImageContour(image: PlacedImage): PlacedImageContourSlice[] {
  const count = clamp(Math.round(image.widthCols), 1, 4);
  return Array.from({ length: count }, (_, index) => {
    const rawTop = image.wrapContour?.top[index] ?? 0;
    const rawBottom = image.wrapContour?.bottom[index] ?? 0;
    const top = clamp(Number.isFinite(rawTop) ? rawTop : 0, 0, MAX_CONTOUR_INSET);
    const bottom = clamp(
      Number.isFinite(rawBottom) ? rawBottom : 0,
      0,
      Math.min(MAX_CONTOUR_INSET, MAX_COMBINED_CONTOUR_INSET - top),
    );
    return { top, bottom };
  });
}

/** A stepped polygon exactly matching the column-sliced exclusion used by the
 * text engine. Clipping the visible frame exposes the reclaimed text area even
 * when the uploaded source itself has an opaque background. */
export function placedImageContourClip(image: PlacedImage): string {
  const slices = placedImageContour(image);
  const top: string[] = [];
  const bottom: string[] = [];
  for (const [index, slice] of slices.entries()) {
    const left = (index / slices.length) * 100;
    const right = ((index + 1) / slices.length) * 100;
    top.push(`${left}% ${slice.top}%`, `${right}% ${slice.top}%`);
  }
  for (let index = slices.length - 1; index >= 0; index -= 1) {
    const slice = slices[index];
    const left = (index / slices.length) * 100;
    const right = ((index + 1) / slices.length) * 100;
    bottom.push(`${right}% ${100 - slice.bottom}%`, `${left}% ${100 - slice.bottom}%`);
  }
  return `polygon(${[...top, ...bottom].join(', ')})`;
}

/** Resolve the frame against today's grid. Height overrides crop, never stretch,
 * the source; older images retain their original aspect-ratio sizing. */
export function placedImageGeometry(
  image: PlacedImage,
  asset: Asset,
  design: Design,
  pageHeight = pageDimensions(design).height,
): PlacedImageGeometry {
  const g = grid(design);
  const widthCols = clamp(Math.round(image.widthCols), 1, Math.min(4, g.totalCols));
  const column = clamp(Math.round(image.anchor.column), 0, g.totalCols - widthCols);
  const width = g.span(widthCols);
  const naturalHeight = asset.naturalWidth > 0
    ? width * (asset.naturalHeight / asset.naturalWidth)
    : 0;
  const height = typeof image.heightMm === 'number' && Number.isFinite(image.heightMm) && image.heightMm > 0
    ? clamp(image.heightMm, 1, pageHeight)
    : naturalHeight;
  const maxTop = Math.max(0, pageHeight - height);
  const left = design.margin + column * (g.col + design.gutter);
  const top = clamp(image.anchor.y, 0, maxTop);
  const right = left + width;
  const bottom = top + height;
  const bleed = image.bleed ?? {};
  const visualLeft = bleed.left ? 0 : left;
  const visualTop = bleed.top ? 0 : top;
  const visualRight = bleed.right ? pageDimensions(design).width : right;
  const visualBottom = bleed.bottom ? pageHeight : bottom;
  return {
    column,
    widthCols,
    left,
    top,
    width,
    height,
    maxTop,
    visualLeft,
    visualTop,
    visualWidth: visualRight - visualLeft,
    visualHeight: visualBottom - visualTop,
    captionLeft: left - visualLeft,
  };
}

/** Snap a physical x coordinate to the nearest valid column start. */
export function snapImageColumn(x: number, widthCols: number, design: Design): number {
  const g = grid(design);
  const width = clamp(Math.round(widthCols), 1, Math.min(4, g.totalCols));
  const maxColumn = g.totalCols - width;
  const raw = (x - design.margin) / (g.col + design.gutter);
  return clamp(Math.round(raw), 0, maxColumn);
}
