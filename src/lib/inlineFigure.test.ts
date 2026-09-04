import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import {
  insertArticleFigure,
  normalizeInlineContinuations,
  removeArticleBlock,
} from './inlineFigure';

describe('caret-positioned article figures', () => {
  it('splits a paragraph into head, anchored figure, and continuation', () => {
    const doc = emptyDoc();
    doc.blocks = [
      {
        id: 'paragraph',
        type: 'paragraph',
        text: 'Alpha beta gamma.',
        fontSize: 14,
        color: '#123456',
      },
    ];

    const figureId = insertArticleFigure(doc, 'asset', { paragraphId: 'paragraph', offset: 11 });

    expect(doc.blocks.map((block) => block.type)).toEqual(['paragraph', 'figure', 'paragraph']);
    expect(doc.blocks[0]).toMatchObject({ text: 'Alpha beta ' });
    expect(doc.blocks[1]).toMatchObject({ id: figureId, assetId: 'asset', span: 'body' });
    expect(doc.blocks[2]).toMatchObject({
      text: 'gamma.',
      continuationOf: figureId,
      fontSize: 14,
      color: '#123456',
    });
  });

  it('joins the two text halves when their anchored image is removed', () => {
    const doc = emptyDoc();
    doc.blocks = [{ id: 'paragraph', type: 'paragraph', text: '**Alpha beta gamma.**' }];
    const figureId = insertArticleFigure(doc, 'asset', { paragraphId: 'paragraph', offset: 9 });
    expect(doc.blocks[1]).toMatchObject({ id: figureId });

    removeArticleBlock(doc, 1);

    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].type).toBe('paragraph');
    expect(doc.blocks[0].type === 'paragraph' ? doc.blocks[0].text.replace(/\*\*/g, '') : '').toBe(
      'Alpha beta gamma.',
    );
  });

  it('turns the tail into an ordinary paragraph when blocks are moved apart', () => {
    const doc = emptyDoc();
    doc.blocks = [{ id: 'paragraph', type: 'paragraph', text: 'Alpha beta gamma.' }];
    insertArticleFigure(doc, 'asset', { paragraphId: 'paragraph', offset: 6 });
    [doc.blocks[1], doc.blocks[2]] = [doc.blocks[2], doc.blocks[1]];

    normalizeInlineContinuations(doc.blocks);

    expect(doc.blocks[1]).toMatchObject({ type: 'paragraph' });
    expect(doc.blocks[1].type === 'paragraph' ? doc.blocks[1].continuationOf : undefined).toBeUndefined();
  });

  it('keeps the old append behaviour when no paragraph caret exists', () => {
    const doc = emptyDoc();
    insertArticleFigure(doc, 'asset');
    expect(doc.blocks.at(-1)).toMatchObject({ type: 'figure', assetId: 'asset', span: 'body' });
  });
});
