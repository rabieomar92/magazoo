import { describe, expect, it } from 'vitest';
import type { Piece } from '../lib/paginate';
import { populatedPhysicalPages } from '../lib/physicalFlowPages';

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
});
