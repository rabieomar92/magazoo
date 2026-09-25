/** Old documents remain centred; imported values cannot place text outside a card. */
export function galleryTextPosition(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 50;
}
