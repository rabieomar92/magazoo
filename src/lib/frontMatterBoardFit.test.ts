import { describe, expect, it, vi } from 'vitest';
import { largestBoardScaleThatFits, largestBoardHeroThatFits } from './frontMatterBoardFit';

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

describe('largestBoardHeroThatFits',()=>{
  it('honours any requested height that fits, without a trim-percentage cap',()=>{
    expect(largestBoardHeroThatFits(105,()=>true)).toBe(105);
    expect(largestBoardHeroThatFits(65,()=>true)).toBe(65);
  });
  it('uses the largest safe height without clipping copy',()=>{
    const height=largestBoardHeroThatFits(164,value=>value<=91.3);
    expect(height).toBeGreaterThanOrEqual(91.1);
    expect(height).toBeLessThanOrEqual(91.3);
  });
  it('retains a minimum and leaves impossible copy to overflow reporting',()=>{
    expect(largestBoardHeroThatFits(164,()=>false)).toBe(25);
  });
});
