import type { Design, PlacedHighlights } from '../schema/document';
import { grid, PAGE_H } from './geometry';

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export function defaultPlacedHighlights(design: Design, pageHeight = PAGE_H): PlacedHighlights {
  const g = grid(design);
  const widthCols = Math.min(2, g.totalCols) as PlacedHighlights['widthCols'];
  return {
    widthCols,
    anchor: {
      page: 1,
      column: Math.max(0, g.totalCols - widthCols),
      y: Math.min(pageHeight - design.margin, design.margin + design.heroHeight + 35),
    },
  };
}

export function placedHighlightsGeometry(
  placement: PlacedHighlights,
  design: Design,
  height = 0,
  pageHeight = PAGE_H,
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
  const maxTop = Math.max(0, pageHeight - Math.max(0, height));
  return {
    widthCols,
    column,
    width,
    left,
    top: clamp(placement.anchor.y, 0, maxTop),
    maxTop,
  };
}

/** Nearest available vertical slot. Shared by dragging and article pagination. */
export function highlightAvoidingTop(desired: number, height: number, pageHeight: number, bands: { top: number; bottom: number }[]) {
  const target = clamp(desired, 0, Math.max(0, pageHeight - height));
  const merged: { top: number; bottom: number }[] = [];
  for (const band of [...bands].sort((a,b) => a.top - b.top)) {
    const current = { top: Math.max(0, band.top), bottom: Math.min(pageHeight, band.bottom) };
    if (current.bottom <= current.top) continue;
    const previous = merged.at(-1);
    if (previous && current.top <= previous.bottom) previous.bottom = Math.max(previous.bottom, current.bottom);
    else merged.push(current);
  }
  const slots: { top: number; bottom: number }[] = [];
  let cursor = 0;
  for (const band of merged) { if (band.top > cursor) slots.push({top:cursor,bottom:band.top}); cursor = Math.max(cursor,band.bottom); }
  if (cursor < pageHeight) slots.push({top:cursor,bottom:pageHeight});
  const candidates = slots.filter(s => s.bottom-s.top >= height-.05).map(s => clamp(target,s.top,s.bottom-height));
  return candidates.sort((a,b) => Math.abs(a-target)-Math.abs(b-target))[0] ?? target;
}
