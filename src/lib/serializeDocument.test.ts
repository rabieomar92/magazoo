import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { serializeDocument } from './serializeDocument';

describe('serializeDocument', () => {
  it('keeps highlight placement in the saved JSON without mutating the live document', async () => {
    const doc = emptyDoc();
    doc.design.highlightsPlacement = 'free';
    doc.highlights = ['A highlight'];
    doc.highlightBox = { widthCols: 2, anchor: { page: 1, column: 1, y: 84.5 } };
    doc.assets.orphan = { src: 'data:image/svg+xml,orphan', naturalWidth: 10, naturalHeight: 10 };

    const saved = JSON.parse(await serializeDocument(doc));

    expect(saved.highlightBox).toEqual(doc.highlightBox);
    expect(saved.highlights).toEqual(['A highlight']);
    expect(saved.assets.orphan).toBeUndefined();
    expect(doc.assets.orphan).toBeDefined();
  });
});
