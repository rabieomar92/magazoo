import { describe, expect, it } from 'vitest';
import { paginate, type FlowItem } from './paginate';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const text = (t: string): FlowItem => ({ kind: 'text', text: t });

const budgetOverflow = (budget: number) => (el: HTMLElement) => (el.textContent?.length ?? 0) > budget;

describe('paginate', () => {
  it('loses no words across the page break, even when a paragraph straddles it', () => {
    const paragraphs = [
      'Paragraph zero holds a short introduction sentence used as page one filler content for the test.',
      'Paragraph one is intentionally long so that it straddles the break between page one and page two during pagination alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey.',
      'Paragraph two lands entirely on page two after the break in this pagination test scenario.',
    ];

    // Fixed budget: fits paragraph zero plus roughly half of paragraph one,
    // forcing the break to land inside paragraph one's word list.
    const budget = paragraphs[0].length + Math.floor(paragraphs[1].length / 2);
    const isOverflowing = budgetOverflow(budget);

    const host1 = document.createElement('div');
    const host2 = document.createElement('div');

    const result = paginate(host1, host2, paragraphs.map(text), isOverflowing);

    const originalWords = paragraphs.flatMap(words);
    const producedWords = result.pages
      .flat()
      .filter((p): p is { kind: 'text'; text: string; cont?: boolean } => p.kind === 'text')
      .flatMap((p) => words(p.text));
    expect(producedWords).toEqual(originalWords);

    expect(result.pages[1][0]?.kind).toBe('text');
    expect((result.pages[1][0] as { cont?: boolean }).cont).toBe(true);
  });

  it('keeps paragraph typography on every piece created by a page split', () => {
    const styled: FlowItem = {
      kind: 'text',
      text: 'Alpha beta gamma delta echo foxtrot golf hotel india juliet kilo lima mike november.',
      fontSize: 13.5,
      color: '#6b21a8',
    };

    const result = paginate(
      document.createElement('div'),
      document.createElement('div'),
      [styled],
      budgetOverflow(42),
    );
    const pieces = result.pages
      .flat()
      .filter((piece): piece is Extract<(typeof result.pages)[number][number], { kind: 'text' }> =>
        piece.kind === 'text',
      );

    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((piece) => piece.fontSize === 13.5 && piece.color === '#6b21a8')).toBe(true);
  });

  it('never splits a figure — a straddling figure moves whole to page 2', () => {
    const items: FlowItem[] = [
      text('Alpha bravo charlie delta echo foxtrot.'),
      { kind: 'figure', id: 'fig-1', aspect: 0.6, hasCaption: true, widthBasis: 'body' },
      text('Golf hotel india juliet kilo lima.'),
    ];

    // jsdom has no layout, so a figure adds no textContent. Model its height by
    // counting the placeholder divs paginate paints. Budget of 500 fits the
    // first paragraph (~39 chars) but not once the figure's 1000 lands.
    const isOverflowing = (el: HTMLElement) =>
      (el.textContent?.length ?? 0) + el.querySelectorAll('.flow-fig').length * 1000 > 500;

    const host1 = document.createElement('div');
    const host2 = document.createElement('div');
    const result = paginate(host1, host2, items, isOverflowing);

    const figures = result.pages.flat().filter((p) => p.kind === 'figure');
    expect(figures).toEqual([{ kind: 'figure', id: 'fig-1' }]);
    // The figure is atomic: it appears exactly once and is never on both pages.
    expect(result.pages[0].some((p) => p.kind === 'figure' && p.id === 'fig-1')).toBe(false);
    expect(result.pages[1].some((p) => p.kind === 'figure' && p.id === 'fig-1')).toBe(true);
  });

  it('lets an anchored figure paragraph fill the page before the figure advances', () => {
    const head = 'Alpha bravo charlie delta echo foxtrot.';
    const tail =
      'Golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey.';
    const items: FlowItem[] = [
      text(head),
      {
        kind: 'figure',
        id: 'anchored-figure',
        aspect: 0.6,
        hasCaption: false,
        widthBasis: 'body',
        floatAnchor: true,
      },
      { kind: 'text', text: tail, cont: true },
    ];
    const isOverflowing = (el: HTMLElement) =>
      (el.textContent?.length ?? 0) + el.querySelectorAll('.flow-fig').length * 1000 > 85;

    const result = paginate(
      document.createElement('div'),
      document.createElement('div'),
      items,
      isOverflowing,
    );

    expect(result.pages[0].some((piece) => piece.kind === 'figure')).toBe(false);
    expect(result.pages[0].filter((piece) => piece.kind === 'text')).toHaveLength(2);
    expect(result.pages[1][0]).toEqual({ kind: 'figure', id: 'anchored-figure' });
    expect(
      result.pages
        .flat()
        .filter((piece): piece is Extract<(typeof result.pages)[number][number], { kind: 'text' }> =>
          piece.kind === 'text',
        )
        .flatMap((piece) => words(piece.text)),
    ).toEqual(words(`${head} ${tail}`));
    expect(
      result.pages[0]
        .filter((piece): piece is Extract<(typeof result.pages)[number][number], { kind: 'text' }> =>
          piece.kind === 'text',
        )
        .at(-1)?.cont,
    ).toBe(true);
  });

  it('lets consecutive reading copy fill the page before a deferred anchored figure', () => {
    const head = 'Alpha bravo charlie delta echo foxtrot.';
    const tail = 'Golf hotel.';
    const following = 'This separate paragraph must continue filling the otherwise blank page area.';
    const items: FlowItem[] = [
      text(head),
      {
        kind: 'figure',
        id: 'anchored-figure',
        aspect: 0.6,
        hasCaption: false,
        widthBasis: 'body',
        floatAnchor: true,
      },
      { kind: 'text', text: tail, cont: true },
      text(following),
    ];
    const isOverflowing = (el: HTMLElement) =>
      (el.textContent?.length ?? 0) + el.querySelectorAll('.flow-fig').length * 1000 > 85;

    const result = paginate(
      document.createElement('div'),
      document.createElement('div'),
      items,
      isOverflowing,
    );

    expect(
      result.pages[0]
        .filter((piece): piece is Extract<(typeof result.pages)[number][number], { kind: 'text' }> =>
          piece.kind === 'text',
        )
        .map((piece) => piece.text)
        .join(' '),
    ).toContain('This separate');
    expect(result.pages[0].some((piece) => piece.kind === 'figure')).toBe(false);
    expect(result.pages[1][0]).toEqual({ kind: 'figure', id: 'anchored-figure' });
    expect(
      result.pages
        .flat()
        .filter((piece): piece is Extract<(typeof result.pages)[number][number], { kind: 'text' }> =>
          piece.kind === 'text',
        )
        .flatMap((piece) => words(piece.text)),
    ).toEqual(words(`${head} ${tail} ${following}`));
  });

  it('spills onto a third page (and beyond) without losing any words', () => {
    // Twelve paragraphs against a tight budget force at least three pages.
    const paragraphs = Array.from(
      { length: 12 },
      (_, i) =>
        `Paragraph ${i} carries several words alpha bravo charlie delta echo foxtrot golf hotel india juliet.`,
    );
    // Budget fits only ~2.5 paragraphs per page, so 12 need 5 pages.
    const budget = paragraphs[0].length * 2.5;
    const isOverflowing = budgetOverflow(budget);

    const host1 = document.createElement('div');
    const host2 = document.createElement('div');
    const result = paginate(host1, host2, paragraphs.map(text), isOverflowing);

    expect(result.pages.length).toBeGreaterThanOrEqual(3);

    const originalWords = paragraphs.flatMap(words);
    const producedWords = result.pages
      .flat()
      .filter((p): p is { kind: 'text'; text: string; cont?: boolean } => p.kind === 'text')
      .flatMap((p) => words(p.text));
    expect(producedWords).toEqual(originalWords);
  });

  it('finishes the page with an interior emphasized spanner so it can bleed from a safe bottom edge', () => {
    const items: FlowItem[] = [
      text('Copy before the emphasized image.'),
      {
        kind: 'figure',
        id: 'edge-figure',
        aspect: 0.5,
        hasCaption: false,
        widthBasis: 2,
        pos: 'right',
        bleed: true,
      },
      text('Copy after the emphasized image.'),
    ];
    const host1 = document.createElement('div');
    const host2 = document.createElement('div');

    const result = paginate(host1, host2, items, () => false);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual([
      { kind: 'text', text: 'Copy before the emphasized image.' },
      { kind: 'figure', id: 'edge-figure' },
    ]);
    expect(result.pages[1]).toEqual([{ kind: 'text', text: 'Copy after the emphasized image.' }]);
  });

  it('keeps an emphasized spanner at the end of a page so it can bleed to the bottom edge', () => {
    const items: FlowItem[] = [
      text('Copy before the emphasized image.'),
      {
        kind: 'figure',
        id: 'bottom-figure',
        aspect: 0.5,
        hasCaption: false,
        widthBasis: 'body',
        bleed: true,
      },
    ];
    const host1 = document.createElement('div');
    const host2 = document.createElement('div');

    const result = paginate(host1, host2, items, () => false);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0][1]).toEqual({ kind: 'figure', id: 'bottom-figure' });
  });

});
