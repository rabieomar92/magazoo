import { describe, expect, it } from 'vitest';
import { fullColumnsForLevelling, isFullColumn } from './fullColumnLevel';

const metric = (remaining: number, lineHeight = 18) => ({
  contentBottom: 500 - remaining,
  usableBottom: 500,
  lineHeight,
});

describe('full-column levelling eligibility', () => {
  it('accepts a column only when less than one more line fits', () => {
    expect(isFullColumn(metric(0))).toBe(true);
    expect(isFullColumn(metric(17))).toBe(true);
    expect(isFullColumn(metric(18))).toBe(false);
    expect(isFullColumn(metric(42))).toBe(false);
  });

  it('rejects clipped columns so pagination handles them instead', () => {
    expect(isFullColumn(metric(-1))).toBe(false);
  });

  it('levels only a group of two or more full columns', () => {
    const first = metric(4);
    const second = metric(12);
    const short = metric(40);
    expect(fullColumnsForLevelling([first, second, short])).toEqual([first, second]);
    expect(fullColumnsForLevelling([first, short])).toEqual([]);
  });
});
