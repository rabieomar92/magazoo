import type { Asset, Design, PlacedImage } from '../schema/document';
import { grid, PAGE_H, PAGE_W } from './geometry';

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

/** Resolve a stored placement against today's grid and source aspect ratio. */
export function placedImageGeometry(
  image: PlacedImage,
  asset: Asset,
  design: Design,
): PlacedImageGeometry {
  const g = grid(design);
  const widthCols = clamp(Math.round(image.widthCols), 1, Math.min(4, g.totalCols));
  const column = clamp(Math.round(image.anchor.column), 0, g.totalCols - widthCols);
  const width = g.span(widthCols);
  const height = asset.naturalWidth > 0
    ? width * (asset.naturalHeight / asset.naturalWidth)
    : 0;
  const maxTop = Math.max(0, PAGE_H - height);
  const left = design.margin + column * (g.col + design.gutter);
  const top = clamp(image.anchor.y, 0, maxTop);
  const right = left + width;
  const bottom = top + height;
  const bleed = image.bleed ?? {};
  const visualLeft = bleed.left ? 0 : left;
  const visualTop = bleed.top ? 0 : top;
  const visualRight = bleed.right ? PAGE_W : right;
  const visualBottom = bleed.bottom ? PAGE_H : bottom;
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
