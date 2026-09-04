import type { Design, PlacedHighlights } from '../schema/document';
import { grid, PAGE_H } from './geometry';

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export function defaultPlacedHighlights(design: Design): PlacedHighlights {
  const g = grid(design);
  const widthCols = Math.min(2, g.totalCols) as PlacedHighlights['widthCols'];
  return {
    widthCols,
    anchor: {
      page: 1,
      column: Math.max(0, g.totalCols - widthCols),
      y: Math.min(PAGE_H - design.margin, design.margin + design.heroHeight + 35),
    },
  };
}

export function placedHighlightsGeometry(
  placement: PlacedHighlights,
  design: Design,
  height = 0,
) {
  const g = grid(design);
  const widthCols = clamp(
    Math.round(placement.widthCols),
    1,
    Math.min(4, g.totalCols),
  ) as PlacedHighlights['widthCols'];
  const column = clamp(Math.round(placement.anchor.column), 0, g.totalCols - widthCols);
  const width = g.span(widthCols);
  const left = design.margin + column * (g.col + design.gutter);
  const maxTop = Math.max(0, PAGE_H - Math.max(0, height));
  return {
    widthCols,
    column,
    width,
    left,
    top: clamp(placement.anchor.y, 0, maxTop),
    maxTop,
  };
}
