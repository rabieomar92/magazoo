import { describe, expect, it, vi } from 'vitest';
import { largestBoardScaleThatFits } from './frontMatterBoardFit';

describe('largestBoardScaleThatFits', () => {
  it('keeps full size when the role list already fits', () => {
    const fits = vi.fn(() => true);
    expect(largestBoardScaleThatFits(fits)).toBe(1);
    expect(fits).toHaveBeenCalledWith(1);
  });

  it('selects the largest fitting scale without crossing the limit', () => {
    const scale = largestBoardScaleThatFits(value => value <= 0.81);
    expect(scale).toBeGreaterThanOrEqual(0.808);
    expect(scale).toBeLessThanOrEqual(0.81);
  });

  it('returns the readable floor when even that cannot fit', () => {
    expect(largestBoardScaleThatFits(() => false, 0.65)).toBe(0.65);
  });
});
