/** Old text cards stay centred; captions pass a bottom default. Bound imported values. */
export function galleryTextPosition(value: number | undefined, fallback = 50): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : fallback;
}
