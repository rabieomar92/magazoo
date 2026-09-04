import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { cloneDocForUpdate } from './useDoc';

describe('cloneDocForUpdate', () => {
  it('keeps embedded source data immutable while cloning every mutable branch', () => {
    const source = emptyDoc();
    source.assets.photo = {
      src: `data:image/png;base64,${'x'.repeat(1000)}`,
      naturalWidth: 100,
      naturalHeight: 50,
    };
    source.images.push({
      id: 'image',
      assetId: 'photo',
      caption: 'Before',
      widthCols: 2,
      anchor: { page: 1, column: 0, y: 20 },
      bleed: { left: true },
    });
    source.highlightBox = {
      widthCols: 2,
      anchor: { page: 1, column: 1, y: 80 },
    };

    const draft = cloneDocForUpdate(source);
    draft.images[0].caption = 'After';
    draft.images[0].anchor.y = 40;
    draft.images[0].bleed!.right = true;
    draft.highlightBox!.anchor.y = 120;
    draft.design.colors.ink = '#fff';

    expect(source.images[0]).toMatchObject({ caption: 'Before', anchor: { y: 20 }, bleed: { left: true } });
    expect(source.design.colors.ink).not.toBe('#fff');
    expect(source.highlightBox.anchor.y).toBe(80);
    expect(draft.assets.photo).not.toBe(source.assets.photo);
    expect(draft.assets.photo.src).toBe(source.assets.photo.src);
  });
});
