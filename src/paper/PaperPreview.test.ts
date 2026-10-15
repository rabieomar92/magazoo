import { describe, expect, it } from 'vitest';
import type { Piece } from '../lib/paginate';
import { physicalPageFit, populatedPhysicalPages } from '../lib/physicalFlowPages';

const copy = (text: string): Piece => ({ kind: 'text', text });
const emptyWrappedPage = (): Piece => ({
  kind: 'image-columns',
  height: 100,
  columns: [{ segments: [{ order: 0, top: 0, bottom: 100, pieces: [] }] }],
});

describe('populatedPhysicalPages', () => {
  it('does not treat an empty image-shaped continuation as an article page', () => {
    expect(
      populatedPhysicalPages(
        [[copy('page one')], [copy('page two')], [emptyWrappedPage()]],
        'paper-1',
      ),
    ).toEqual([1, 2]);
  });

  it('maps both Paper 2 opening regions to physical sheet one', () => {
    expect(
      populatedPhysicalPages(
        [[copy('left opening')], [copy('right opening')], [copy('continuation')]],
        'paper-2',
      ),
    ).toEqual([1, 2]);
  });

  it('accounts for editorial cover sheets before article flow', () => {
    expect(populatedPhysicalPages([[copy('article')]], 'magazine-1')).toEqual([2]);
    expect(populatedPhysicalPages([[copy('article')]], 'magazine-3')).toEqual([3]);
  });

  it('reports three Magazine 2 sheets when article text continues after its dedicated photo sheet', () => {
    const pagination = { pages: [[copy('opening article')], [copy('continued article')]], fill: .98, spill: 44 };
    const physicalPages = populatedPhysicalPages(pagination.pages, 'magazine-2');
    expect(physicalPages).toEqual([1, 3]);
    expect(physicalPageFit(pagination, Math.max(...physicalPages))).toEqual({
      level: 'ok', text: '3 pages · last page 98% full',
    });
    expect(pagination.pages).toHaveLength(2);
  });

  it('retains the existing low-fullness warning and suggested word count', () => {
    const pagination = { pages: [[copy('opening')], [copy('short continuation')]], fill: .1, spill: 37 };
    expect(physicalPageFit(pagination, 3)).toEqual({
      level: 'warn', text: '3 pages · last page nearly empty. Cut ~37 words to save a page.',
    });
    expect(physicalPageFit({ pages: [[copy('single article')]], fill: .9, spill: 0 }, 1))
      .toEqual({ level: 'ok', text: '1 page' });
  });
});
