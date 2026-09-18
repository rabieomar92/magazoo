import { describe, expect, it } from 'vitest';
import { choosePictures, columnGap, mosaicSeed, packColumns, pictureRatios } from './mosaic';

const COLUMN = 900;
const GAP = 14;

/** Total height a column's cards occupy, gaps included. */
const used = (heights: readonly number[], indices: readonly number[]) =>
  indices.reduce((sum, index) => sum + heights[index], 0) + GAP * Math.max(0, indices.length - 1);

describe('contents column packing', () => {
  it('never lets a column hold more than it can show', () => {
    for (let run = 0; run < 200; run++) {
      const heights = Array.from({ length: 1 + (run % 30) }, (_, i) => 60 + ((run * 37 + i * 53) % 300));
      const { pages } = packColumns(heights, { columnHeight: COLUMN, gap: GAP });
      for (const page of pages) {
        for (const column of page) {
          // A column may be over only when a single card is taller than the
          // whole column, which the card's own picture cap prevents.
          if (column.length > 1) expect(used(heights, column)).toBeLessThanOrEqual(COLUMN);
        }
      }
    }
  });

  it('fills from the top, in reading order, column by column then page by page', () => {
    const heights = Array.from({ length: 14 }, () => 200);
    const { pages, placed } = packColumns(heights, { columnHeight: COLUMN, gap: GAP });
    const order = pages.flat().flat();
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(placed).toBe(order.length);
    // Four cards of 200 plus three gaps is 842, so a column holds four at
    // most. The first sheet fills brim-full; the last sheet evens out its six
    // remaining cards rather than leaving four beside two.
    expect(pages[0][0]).toEqual([0, 1, 2, 3]);
    expect(pages[0][1]).toEqual([4, 5, 6, 7]);
    expect(pages[1][0]).toEqual([8, 9, 10]);
    expect(pages[1][1]).toEqual([11, 12, 13]);
    for (const column of pages.flat()) expect(used(heights, column)).toBeLessThanOrEqual(COLUMN);
  });

  it('reports what will not fit rather than drawing it off the page', () => {
    const heights = Array.from({ length: 40 }, () => 250);
    const { pages, placed } = packColumns(heights, { columnHeight: COLUMN, gap: GAP });
    expect(placed).toBeLessThan(heights.length);
    expect(pages.flat().flat()).toHaveLength(placed);
    expect(placed).toBe(12);
  });

  it('places a card taller than a column on its own rather than losing it', () => {
    const heights = [200, 1400, 200];
    const { pages, placed } = packColumns(heights, { columnHeight: COLUMN, gap: GAP });
    expect(placed).toBe(3);
    const columns = pages.flat().filter(column => column.length);
    expect(columns.flat()).toEqual([0, 1, 2]);
    expect(columns.find(column => column.includes(1))).toEqual([1]);
  });

  it('evens out the last sheet rather than leaving a column empty beside a full one', () => {
    // Greedily these seven short cards all fit in one column, leaving the
    // second bare. The final sheet has to share them out.
    const heights = [100, 100, 100, 100, 100, 100, 100];
    const { pages } = packColumns(heights, { columnHeight: COLUMN, gap: GAP, pages: 1 });
    expect(pages[0][0].length).toBeGreaterThan(1);
    expect(pages[0][1].length).toBeGreaterThan(1);
    expect(pages[0].flat()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (const column of pages[0]) expect(used(heights, column)).toBeLessThanOrEqual(COLUMN);
  });

  it('uses both sheets rather than printing a blank one', () => {
    // Four short cards would all fit in the first column. A contents spread is
    // two sheets regardless, so they have to be shared out.
    const heights = [120, 120, 120, 120];
    const { pages } = packColumns(heights, { columnHeight: COLUMN, gap: GAP });
    expect(pages[1].flat().length).toBeGreaterThan(0);
    expect(pages.flat().flat()).toEqual([0, 1, 2, 3]);
  });

  it('spreads a short column’s slack between its cards, up to a limit', () => {
    // Three 100pt cards in a 900pt column: 600 spare over two gaps.
    expect(columnGap([100, 100, 100], 900, GAP, 1000)).toBeCloseTo(GAP + (900 - 300 - GAP * 2) / 2, 5);
    // Capped, so cards never drift apart into unrelated fragments.
    expect(columnGap([100, 100, 100], 900, GAP, 40)).toBe(GAP + 40);
    // A nearly full column gets only the little slack it actually has.
    expect(columnGap([440, 440], 900, GAP, 40)).toBe(GAP + 6);
    // An over-full column keeps its base gap, never a negative one.
    expect(columnGap([500, 500], 900, GAP, 40)).toBe(GAP);
    expect(columnGap([500], 900, GAP, 40)).toBe(GAP);
  });

  it('keeps a picture’s own shape, varied but never able to eat a column', () => {
    const aspects = [3 / 2, 2 / 3, 1, 16 / 9, undefined];
    const ratios = pictureRatios(aspects, mosaicSeed(['a', 'b']));
    expect(ratios).toHaveLength(aspects.length);
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(0.5);
      expect(ratio).toBeLessThanOrEqual(1.18);
    }
    // Upright pictures stay taller than wide ones.
    expect(ratios[1]).toBeGreaterThan(ratios[0]);
    // Stable for one issue, different once shuffled.
    expect(pictureRatios(aspects, mosaicSeed(['a', 'b']))).toEqual(ratios);
    expect(pictureRatios(aspects, mosaicSeed(['a', 'b'], 1))).not.toEqual(ratios);
  });
});

describe('automatic pictures', () => {
  const pack = { columnHeight: COLUMN, gap: GAP };
  const choice = (over: Partial<Parameters<typeof choosePictures>[0]> = {}) => choosePictures({
    text: [100, 100, 100, 100],
    picture: [400, 400, 400, 400],
    eligible: [true, true, true, true],
    forced: [undefined, undefined, undefined, undefined],
    order: [0, 1, 2, 3],
    pack,
    ...over,
  });

  it('hands out as many pictures as the sheets can actually hold', () => {
    // Four columns of 900: text-only is trivial, and every card can afford a
    // picture, so every card gets one.
    expect(choice()).toEqual([true, true, true, true]);
  });

  it('stops before the spread overflows', () => {
    // Twelve cards on four 900pt columns: as text they fit easily, but a
    // picture costs 300pt each, so only some can have one.
    const text = Array.from({ length: 12 }, () => 100);
    const picture = Array.from({ length: 12 }, () => 400);
    const chosen = choosePictures({
      text, picture,
      eligible: text.map(() => true),
      forced: text.map(() => undefined),
      order: text.map((_, i) => i),
      pack,
    });
    const withPictures = chosen.filter(Boolean).length;
    expect(withPictures).toBeGreaterThan(0);
    expect(withPictures).toBeLessThan(12);
    const heights = chosen.map((on, i) => (on ? picture[i] : text[i]));
    expect(packColumns(heights, pack).placed).toBe(12);
  });

  it('never gives a picture to an entry that has none, or that the editor turned off', () => {
    expect(choice({ eligible: [true, false, true, true] })[1]).toBe(false);
    expect(choice({ forced: [undefined, false, undefined, undefined] })[1]).toBe(false);
  });

  it('honours an entry the editor insists on, and follows the stated order', () => {
    const text = Array.from({ length: 8 }, () => 200);
    const picture = Array.from({ length: 8 }, () => 700);
    const chosen = choosePictures({
      text, picture,
      eligible: text.map(() => true),
      forced: text.map((_, i) => (i === 7 ? true : undefined)),
      order: [3, 0, 1, 2, 4, 5, 6, 7],
      pack,
    });
    expect(chosen[7]).toBe(true);
    // The first name in the order gets first refusal.
    expect(chosen[3]).toBe(true);
    expect(packColumns(chosen.map((on, i) => (on ? picture[i] : text[i])), pack).placed).toBe(8);
  });

  it('gives up even an insisted-upon picture when the text alone will not fit', () => {
    const text = Array.from({ length: 40 }, () => 200);
    const picture = Array.from({ length: 40 }, () => 600);
    const chosen = choosePictures({
      text, picture,
      eligible: text.map(() => true),
      forced: text.map(() => true),
      order: text.map((_, i) => i),
      pack,
    });
    // Nothing can make forty 200pt cards fit four 900pt columns; the caller
    // steps the density next, and it should be starting from bare text.
    expect(chosen.every(on => !on)).toBe(true);
  });
});
