export interface FullColumnMetric {
  contentBottom: number;
  usableBottom: number;
  lineHeight: number;
}

/** Levelling may expand an existing gap, never invent one in no-gap prose. */
export function canExpandParagraphGap(marginBottom: number): boolean {
  return Number.isFinite(marginBottom) && marginBottom > 0;
}

/**
 * A column is full only when its final line is inside the writable area and
 * less than one complete line remains. A clipped/overflowing column is not a
 * levelling candidate; pagination must fix it instead.
 */
export function isFullColumn(metric: FullColumnMetric): boolean {
  const remaining = metric.usableBottom - metric.contentBottom;
  const lineHeight = Math.max(1, metric.lineHeight);
  return remaining >= -0.5 && remaining < lineHeight - 0.5;
}

/** Levelling has meaning only between two or more columns that are already
 * full. Short columns are intentionally absent from the returned group. */
export function fullColumnsForLevelling<T extends FullColumnMetric>(
  columns: readonly T[],
): T[] {
  const full = columns.filter(isFullColumn);
  return full.length >= 2 ? full : [];
}
