import { describe, expect, it } from 'vitest';
import { barStartsRight } from './barSide';

describe('barStartsRight', () => {
  it('alternates from a left page-1 choice', () => {
    expect([0, 1, 2, 3].map((page) => barStartsRight('left', page))).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });

  it('alternates from a right page-1 choice', () => {
    expect([0, 1, 2, 3].map((page) => barStartsRight('right', page))).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('keeps the backward-compatible left default', () => {
    expect(barStartsRight(undefined, 0)).toBe(false);
    expect(barStartsRight(undefined, 1)).toBe(true);
  });
});
