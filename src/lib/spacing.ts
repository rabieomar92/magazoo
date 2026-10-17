/** Signed margins can tighten or overlap adjacent copy. Padding, physical
 * dimensions and page-edge coordinates deliberately keep their own limits. */
export const SUBTITLE_GAP = { min: -40, max: 40 };
export const COVER_STORY_GAP = { min: -40, max: 120 };
export const TEXT_SPACE_AFTER = { min: -100, max: 100 };

export function clampSpacing(value: number | undefined, range: { min: number; max: number }, fallback = 0) {
  return Math.max(range.min, Math.min(range.max, Number.isFinite(value) ? value! : fallback));
}
