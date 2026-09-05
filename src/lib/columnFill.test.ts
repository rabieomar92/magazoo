import { describe, expect, it, vi } from 'vitest';
import {
  exclusionGradient,
  findBalancedImageHeight,
  fillColumns,
  fillColumnsAroundImages,
  fillInlineColumns,
  mergeExclusions,
  overflowsY,
  type FilledImageColumn,
} from './columnFill';
import { emptyDoc } from '../schema/document';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const text = (t: string) => ({ kind: 'text' as const, text: t });

const budgetOverflow = (budget: number) => (el: HTMLElement) => (el.textContent?.length ?? 0) > budget;
const imageWordsInReadingOrder = (columns: FilledImageColumn[]) =>
  columns
    .flatMap((column) => column.segments)
    .sort((a, b) => a.order - b.order)
    .flatMap((segment) => segment.pieces)
    .flatMap((piece) => words(piece.text));

describe('fillColumns', () => {
  it('fills earlier columns to the full budget before opening the next, leaving only the last short', () => {
    // Six roughly-equal paragraphs, budget fits ~2.5 of them — so column 1 and
    // column 2 should each end up with 2 whole paragraphs (straddling the 3rd
    // gets split), and whatever's left closes out the last column.
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) => `Paragraph ${i} carries alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo.`,
    );
    const budget = paragraphs[0].length * 2.5;
    const isOverflowing = budgetOverflow(budget);
    const probe = document.createElement('div');

    const { columns, remainder } = fillColumns(paragraphs.map(text), probe, 4, isOverflowing);

    expect(columns).toHaveLength(4);
    expect(remainder).toEqual([]);
    // No word lost or duplicated across the whole split.
    const originalWords = paragraphs.flatMap(words);
    const producedWords = columns.flat().flatMap((p) => words(p.text));
    expect(producedWords).toEqual(originalWords);

    // First two columns are each "full" (can't take even one more whole word
    // without exceeding budget) — the defining behaviour this module exists
    // for for (true sequential fill, not Chromium's balance-like spread).
    for (const col of columns.slice(0, 2)) {
      expect(col.length).toBeGreaterThan(0);
      const usedChars = col.reduce((n, p) => n + p.text.length, 0);
      expect(usedChars).toBeLessThanOrEqual(budget);
      expect(usedChars).toBeGreaterThan(budget - paragraphs[0].split(' ')[0].length - 1);
    }
  });

  it('leaves trailing columns empty when the content does not need them', () => {
    // One short paragraph, way under budget — every column after the first
    // should end up empty rather than the content being spread thin across
    // all of them (the exact Chromium bug this module works around).
    const probe = document.createElement('div');
    const isOverflowing = budgetOverflow(10_000);

    const { columns, remainder } = fillColumns([text('Just one short paragraph.')], probe, 3, isOverflowing);

    expect(columns).toHaveLength(3);
    expect(columns[0]).toEqual([{ kind: 'text', text: 'Just one short paragraph.' }]);
    expect(columns[1]).toEqual([]);
    expect(columns[2]).toEqual([]);
    expect(remainder).toEqual([]);
  });

  it('splits a straddling paragraph at a word boundary and marks the tail a continuation', () => {
    const long = words(
      'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey',
    );
    // Budget big enough that both halves individually fit their own column
    // (the whole paragraph is ~173 chars) — this test is about the mid-word
    // split + cont marker, not about a genuine overflow-into-remainder.
    const budget = 100;
    const isOverflowing = budgetOverflow(budget);
    const probe = document.createElement('div');

    const { columns, remainder } = fillColumns([text(long.join(' '))], probe, 2, isOverflowing);

    expect(columns).toHaveLength(2);
    expect(columns[0]).toHaveLength(1);
    expect(columns[0][0].indent).toBeUndefined();
    expect(columns[1]).toHaveLength(1);
    expect(columns[1][0].cont).toBe(true);
    expect(remainder).toEqual([]);

    // No word lost across the split.
    const producedWords = [...columns[0], ...columns[1]].flatMap((p) => words(p.text));
    expect(producedWords).toEqual(long);
  });

  it('never loses progress on an item that alone exceeds one column (progress guard)', () => {
    const probe = document.createElement('div');
    // Budget so tight that not even one word fits — forces the guard path.
    const isOverflowing = () => true;

    const { columns } = fillColumns([text('word'), text('second')], probe, 3, isOverflowing);

    // Still terminates and keeps every item somewhere.
    expect(columns.flat().map((p) => p.text)).toEqual(['word', 'second']);
  });

  it('returns genuine leftover as `remainder` once every column is bounded-fit, instead of dumping it unbounded into the last one', () => {
    // Content that needs more than 2 columns' worth, asked for only 2 —
    // column 2 (the last one allowed here) still gets the same bounded-fit
    // treatment as column 1, and whatever doesn't fit comes back as remainder
    // rather than being force-fit (which would silently overflow/clip in the
    // real, height-clipped box).
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) => `Paragraph ${i} alpha bravo charlie delta echo foxtrot golf hotel india juliet.`,
    );
    const budget = paragraphs[0].length * 2; // ~2 paragraphs per column
    const isOverflowing = budgetOverflow(budget);
    const probe = document.createElement('div');

    const { columns, remainder } = fillColumns(paragraphs.map(text), probe, 2, isOverflowing);

    expect(columns).toHaveLength(2);
    expect(remainder.length).toBeGreaterThan(0);
    // Nothing lost: columns + remainder together still cover every word.
    const originalWords = paragraphs.flatMap(words);
    const producedWords = [...columns.flat(), ...remainder].flatMap((p) => words(p.text));
    expect(producedWords).toEqual(originalWords);
    // Column 2 (the "last" one) is bounded exactly like column 1 — not simply
    // handed the entire remaining array unchecked.
    const col2Chars = columns[1].reduce((n, p) => n + p.text.length, 0);
    expect(col2Chars).toBeLessThanOrEqual(budget);
  });
});

describe('fillInlineColumns', () => {
  it('keeps a one-column figure atomic while filling earlier reading-order columns first', () => {
    const doc = emptyDoc();
    doc.assets.figure = {
      src: 'data:image/png;base64,AA==',
      naturalWidth: 100,
      naturalHeight: 80,
    };
    doc.blocks = [
      {
        id: 'inline-figure',
        type: 'figure',
        assetId: 'figure',
        caption: 'Caption occupies real layout space.',
        span: 1,
      },
    ];
    const pieces = [
      text('alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november'),
      { kind: 'figure' as const, id: 'inline-figure' },
      text('oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu'),
    ];
    const probe = document.createElement('div');
    let measuredCaption = false;
    const isOverflowing = (el: HTMLElement) => {
      measuredCaption ||= el.querySelector('figcaption')?.textContent === 'Caption occupies real layout space.';
      const figureCost = el.querySelectorAll('.flow-fig').length * 70;
      return (el.textContent?.length ?? 0) + figureCost > 120;
    };

    const { columns, remainder } = fillInlineColumns(pieces, doc, probe, 3, isOverflowing);

    expect(remainder).toEqual([]);
    expect(measuredCaption).toBe(true);
    expect(columns.flat().filter((piece) => piece.kind === 'figure')).toEqual([
      { kind: 'figure', id: 'inline-figure' },
    ]);
    expect(columns.slice(0, -1).every((column) => column.length > 0)).toBe(true);
    expect(columns.flatMap((column) => column.filter((piece) => piece.kind === 'text')).flatMap((piece) => words(piece.text))).toEqual(
      pieces.filter((piece) => piece.kind === 'text').flatMap((piece) => words(piece.text)),
    );
  });
});

describe('image-shaped columns', () => {
  it('rejects a fractionally clipped glyph line even when rounded scroll metrics say it fits', () => {
    const probe = document.createElement('div');
    probe.innerHTML = '<p>فيزيک ممبنتو کيت</p>';
    Object.defineProperties(probe, {
      clientHeight: { value: 40 },
      clientWidth: { value: 100 },
      scrollHeight: { value: 40 },
      scrollWidth: { value: 100 },
      offsetHeight: { value: 40 },
      clientTop: { value: 0 },
    });
    probe.getBoundingClientRect = () =>
      ({ top: 0, bottom: 40, left: 0, right: 100, width: 100, height: 40 } as DOMRect);
    const rangeSpy = vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () =>
        [{ top: 25, bottom: 40.6, left: 0, right: 80, width: 80, height: 15.6 }] as unknown as DOMRectList,
    } as unknown as Range);

    try {
      expect(overflowsY(probe)).toBe(true);
    } finally {
      rangeSpy.mockRestore();
    }
  });

  it('merges overlapping exclusion bands into one CSS shape', () => {
    const merged = mergeExclusions([
      { top: 20, bottom: 80 },
      { top: 60, bottom: 120 },
      { top: 180, bottom: 220 },
    ]);
    expect(merged).toEqual([
      { top: 20, bottom: 120 },
      { top: 180, bottom: 220 },
    ]);
    expect(exclusionGradient(merged)).toContain('#000 20px');
    expect(exclusionGradient(merged)).toContain('transparent 220px');
  });

  it('moves words from an image-reduced column into the next column', () => {
    const probe = document.createElement('div');
    const source = text('one two three four five six seven eight nine ten eleven twelve');
    const isOverflowing = (element: HTMLElement) => {
      const wordCount = words(
        Array.from(element.querySelectorAll('p')).map((p) => p.textContent ?? '').join(' '),
      ).length;
      const capacity = Math.floor((parseFloat(element.style.height) || 0) / 10);
      return wordCount > capacity;
    };

    const { columns, remainder } = fillColumnsAroundImages(
      [source],
      probe,
      [[{ top: 20, bottom: 80 }], []],
      100,
      isOverflowing,
    );

    expect(
      columns.map((column) =>
        column.segments.flatMap((segment) => segment.pieces).flatMap((piece) => words(piece.text)).length,
      ),
    ).toEqual([4, 8]);
    expect(remainder).toEqual([]);
    expect(imageWordsInReadingOrder(columns)).toEqual(words(source.text));
    expect(columns.map((column) => column.segments.map((segment) => segment.order))).toEqual([
      [0, 1],
      [2],
    ]);
  });

  it('finishes the space below a leading-column image before moving to the next column', () => {
    const probe = document.createElement('div');
    const source = text('one two three four five six seven eight nine ten eleven twelve thirteen fourteen');
    const isOverflowing = (element: HTMLElement) => {
      const wordCount = words(element.textContent ?? '').length;
      return wordCount > Math.floor((parseFloat(element.style.height) || 0) / 10);
    };

    const { columns, remainder } = fillColumnsAroundImages(
      [source],
      probe,
      [[{ top: 0, bottom: 60 }], [], []],
      100,
      isOverflowing,
    );

    expect(remainder).toEqual([]);
    expect(
      columns.map((column) =>
        column.segments.flatMap((segment) => segment.pieces).flatMap((piece) => words(piece.text)),
      ),
    ).toEqual([
      ['one', 'two', 'three', 'four'],
      ['five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'],
      [],
    ]);
    expect(columns.map((column) => column.segments.map((segment) => segment.order))).toEqual([
      [0],
      [1],
      [2],
    ]);
    expect(imageWordsInReadingOrder(columns)).toEqual(words(source.text));
  });

  it('fills both sides of a wide image in every covered column', () => {
    const probe = document.createElement('div');
    const source = text('one two three four five six seven eight nine ten eleven twelve');
    const isOverflowing = (element: HTMLElement) => {
      const wordCount = words(
        Array.from(element.querySelectorAll('p')).map((p) => p.textContent ?? '').join(' '),
      ).length;
      return wordCount > Math.floor((parseFloat(element.style.height) || 0) / 10);
    };
    const wideBand = [{ top: 20, bottom: 80 }];

    const { columns, remainder } = fillColumnsAroundImages(
      [source],
      probe,
      [wideBand, wideBand, wideBand],
      100,
      isOverflowing,
    );

    expect(remainder).toEqual([]);
    expect(columns).toHaveLength(3);
    expect(columns.map((column) => column.segments.map((segment) => segment.pieces.length))).toEqual([
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
    expect(columns.map((column) => column.segments.map((segment) => segment.order))).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(imageWordsInReadingOrder(columns)).toEqual(words(source.text));
  });

  it('measures an RTL opener with the same drop-cap markup used by the visible flow', () => {
    const probe = document.createElement('div');
    const source = text('فيزيک ممبنتو کيت ممهمي عالم دان تيکنولوݢي مودن');
    let sawMeasuredOpener = false;
    const isOverflowing = (element: HTMLElement) => {
      sawMeasuredOpener ||= Boolean(element.querySelector('p.flow-opener > .drop-cap'));
      return false;
    };

    const { columns, remainder } = fillColumnsAroundImages(
      [source],
      probe,
      [[{ top: 50, bottom: 80 }]],
      120,
      isOverflowing,
    );

    expect(sawMeasuredOpener).toBe(true);
    expect(remainder).toEqual([]);
    expect(imageWordsInReadingOrder(columns)).toEqual(words(source.text));
  });

  it('finds a common final baseline while retaining every word around image bands', () => {
    const probe = document.createElement('div');
    const source = text('one two three four five six seven eight nine ten eleven twelve');
    const isOverflowing = (element: HTMLElement) => {
      const wordCount = words(element.textContent ?? '').length;
      return wordCount > Math.floor((parseFloat(element.style.height) || 0) / 10);
    };

    const height = findBalancedImageHeight(
      [source],
      probe,
      [[], [], []],
      100,
      isOverflowing,
    );
    const balanced = fillColumnsAroundImages(
      [source],
      probe,
      [[], [], []],
      height,
      isOverflowing,
    );

    expect(height).toBeGreaterThanOrEqual(40);
    expect(height).toBeLessThan(42);
    expect(balanced.remainder).toEqual([]);
    expect(imageWordsInReadingOrder(balanced.columns)).toEqual(words(source.text));
    expect(
      balanced.columns.map((column) =>
        column.segments.flatMap((segment) => segment.pieces).flatMap((piece) => words(piece.text)).length,
      ),
    ).toEqual([4, 4, 4]);
  });

});
