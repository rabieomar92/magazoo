import { describe, expect, it } from 'vitest';
import { emptyDoc, type Doc } from '../schema/document';
import type { Piece } from './paginate';
import { wrapAll, wrapPartialFigures } from './textWrap';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

function docWithFigure(pos: 'left' | 'center' | 'right', span: 1 | 2 | 3 | 4 = 2): Doc {
  const doc = emptyDoc();
  doc.assets.figure = { src: 'data:image/svg+xml,', naturalWidth: 400, naturalHeight: 200 };
  doc.blocks = [{ id: 'figure', type: 'figure', assetId: 'figure', caption: '', span, pos }];
  return doc;
}

function wrapped(pos: 'left' | 'center' | 'right', rtl = false) {
  const copy = 'one two three four five six seven eight nine ten eleven twelve';
  const pieces: Piece[] = [
    { kind: 'text', text: 'copy before the figure proves mid-flow wrapping' },
    { kind: 'figure', id: 'figure' },
    { kind: 'text', text: copy },
    { kind: 'equation', id: 'stop' },
  ];
  const probe = document.createElement('div');
  const result = wrapPartialFigures(
    pieces,
    docWithFigure(pos),
    4,
    100,
    10,
    probe,
    (el) => (el.textContent?.length ?? 0) > 28,
    rtl,
  );
  const row = result[1];
  expect(row.kind).toBe('wrap-row');
  if (row.kind !== 'wrap-row') throw new Error('expected wrap row');
  return { result, row, copy };
}

describe('partial-width figure wrapping', () => {
  it.each([
    ['left', [2, 3]],
    ['center', [0, 3]],
    ['right', [0, 1]],
  ] as const)('fills the unused physical columns for a %s figure', (pos, columns) => {
    const { row } = wrapped(pos);
    expect(row.sideColumns.map((col) => col.column)).toEqual(columns);
  });

  it('works after preceding body copy and loses or duplicates no words', () => {
    const { result, row, copy } = wrapped('left');
    expect(result[0]).toMatchObject({ kind: 'text' });
    expect(result.at(-1)).toEqual({ kind: 'equation', id: 'stop' });
    const beside = row.sideColumns.flatMap((col) => col.pieces).flatMap((piece) => words(piece.text));
    const below = result
      .slice(2, -1)
      .filter((piece): piece is Extract<Piece, { kind: 'text' }> => piece.kind === 'text')
      .flatMap((piece) => words(piece.text));
    expect([...beside, ...below]).toEqual(words(copy));
  });

  it('fills free tracks from adjacent preceding copy when the figure ends the text run', () => {
    const copy =
      'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
    const probe = document.createElement('div');
    const result = wrapPartialFigures(
      [
        { kind: 'text', text: copy },
        { kind: 'figure', id: 'figure', wrapHeight: 120 },
        { kind: 'equation', id: 'stop' },
      ],
      docWithFigure('right'),
      4,
      100,
      10,
      probe,
      (el) => (el.textContent?.length ?? 0) > 34,
    );
    const row = result[0];
    expect(row.kind).toBe('wrap-row');
    if (row.kind !== 'wrap-row') throw new Error('expected wrap row');
    expect(row.sideColumns.map((column) => column.column)).toEqual([0, 1]);
    const beside = row.sideColumns.flatMap((column) => column.pieces).flatMap((piece) => words(piece.text));
    const below = result
      .slice(1, -1)
      .filter((piece): piece is Extract<Piece, { kind: 'text' }> => piece.kind === 'text')
      .flatMap((piece) => words(piece.text));
    expect([...beside, ...below]).toEqual(words(copy));
    expect(result.at(-1)).toEqual({ kind: 'equation', id: 'stop' });
  });

  it('reverses side-column reading order for RTL without changing placement', () => {
    const { row } = wrapped('left', true);
    expect(row.sideColumns.map((col) => col.column)).toEqual([3, 2]);
  });

  it('leaves spans that fill the host and single-column figures in ordinary flow', () => {
    const probe = document.createElement('div');
    const full = wrapPartialFigures(
      [{ kind: 'figure', id: 'figure' }],
      docWithFigure('left', 4),
      3,
      100,
      10,
      probe,
      () => false,
    );
    const single = wrapPartialFigures(
      [{ kind: 'figure', id: 'figure' }],
      docWithFigure('left', 1),
      4,
      100,
      10,
      probe,
      () => false,
    );
    expect(full).toEqual([{ kind: 'figure', id: 'figure', fcols: 3 }]);
    expect(single).toEqual([{ kind: 'figure', id: 'figure' }]);
  });

  it('uses the measured remaining page height to fill every free track beside a bottom-edge figure', () => {
    const copy = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen';
    const probe = document.createElement('div');
    const overflowByHeight = (el: HTMLElement) =>
      (el.textContent?.length ?? 0) > (parseFloat(el.style.height) || 0) / 4;
    const base: Piece[] = [
      { kind: 'figure', id: 'figure' },
      { kind: 'text', text: copy },
    ];
    const edge: Piece[] = [
      { kind: 'figure', id: 'figure', wrapHeight: 320 },
      { kind: 'text', text: copy },
    ];

    const baseResult = wrapPartialFigures(base, docWithFigure('right'), 4, 100, 10, probe, overflowByHeight);
    const edgeResult = wrapPartialFigures(edge, docWithFigure('right'), 4, 100, 10, probe, overflowByHeight);
    const besideWords = (result: Piece[]) => {
      const row = result[0];
      if (row.kind !== 'wrap-row') throw new Error('expected wrap row');
      return row.sideColumns.flatMap((col) => col.pieces).flatMap((piece) => words(piece.text));
    };

    expect(besideWords(edgeResult).length).toBeGreaterThan(besideWords(baseResult).length);
    expect(besideWords(edgeResult)).toEqual(words(copy));
  });

  it('borrows leading copy from the next page into otherwise-empty figure tracks', () => {
    const doc = docWithFigure('right');
    const host = document.createElement('div');
    host.style.columnCount = '4';
    host.style.columnGap = '10px';
    Object.defineProperty(host, 'clientWidth', { value: 430 });
    const probe = document.createElement('div');
    const donor = 'borrowed words continue through the free columns beside the image';

    const result = wrapAll(
      [
        [{ kind: 'figure', id: 'figure', wrapHeight: 160 }],
        [
          { kind: 'text', text: donor },
          { kind: 'equation', id: 'stop' },
        ],
      ],
      doc,
      [host],
      probe,
    );

    const row = result[0][0];
    expect(row.kind).toBe('wrap-row');
    if (row.kind !== 'wrap-row') throw new Error('expected wrap row');
    expect(
      row.sideColumns.flatMap((column) => column.pieces).flatMap((piece) => words(piece.text)),
    ).toEqual(words(donor));
    expect(result[1]).toEqual([{ kind: 'equation', id: 'stop' }]);
  });
});
