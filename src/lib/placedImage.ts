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
