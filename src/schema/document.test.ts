import { describe, expect, it } from 'vitest';
import { cleanOrphanedAssets, emptyDoc, migrate, uid } from './document';

describe('cleanOrphanedAssets', () => {
  it('retains referenced assets and strips orphaned assets', () => {
    const doc = emptyDoc();
    const heroId = uid();
    const coverId = uid();
    const figId = uid();
    const backgroundId = uid();
    const orphanId = uid();
    const placedId = uid();

    doc.hero.assetId = heroId;
    doc.cover = { assetId: coverId, offsetX: 0, offsetY: 0, scale: 1 };
    doc.blocks = [
      { id: uid(), type: 'figure', assetId: figId, caption: 'Test', span: 1 },
      { id: uid(), type: 'paragraph', text: 'Hello' },
    ];
    doc.design.pageBackgroundAssetId = backgroundId;
    doc.images.push({
      id: uid(),
      assetId: placedId,
      caption: '',
      widthCols: 2,
      anchor: { page: 1, column: 0, y: 20 },
    });

    doc.assets = {
      [heroId]: { src: 'data:image/svg+xml;hero', naturalWidth: 100, naturalHeight: 100 },
      [coverId]: { src: 'data:image/svg+xml;cover', naturalWidth: 100, naturalHeight: 100 },
      [figId]: { src: 'data:image/svg+xml;fig', naturalWidth: 100, naturalHeight: 100 },
      [backgroundId]: { src: 'data:image/svg+xml;background', naturalWidth: 100, naturalHeight: 100 },
      [placedId]: { src: 'data:image/svg+xml;placed', naturalWidth: 100, naturalHeight: 100 },
      [orphanId]: { src: 'data:image/svg+xml;orphan', naturalWidth: 100, naturalHeight: 100 },
    };

    cleanOrphanedAssets(doc);

    expect(doc.assets[heroId]).toBeDefined();
    expect(doc.assets[coverId]).toBeDefined();
    expect(doc.assets[figId]).toBeDefined();
    expect(doc.assets[backgroundId]).toBeDefined();
    expect(doc.assets[placedId]).toBeDefined();
    expect(doc.assets[orphanId]).toBeUndefined();
  });
});

describe('retired templates', () => {
  it('opens an old Paper 3 file with the standard paper engine', () => {
    const legacy = { ...emptyDoc(), templateId: 'paper-3' };
    expect(migrate(legacy).templateId).toBe('paper-1');
  });
});

describe('subtitle spacing migration', () => {
  it('restores the selected template native gap in older saved files', () => {
    const legacy = emptyDoc();
    legacy.templateId = 'magazine-2';
    delete (legacy.design as Partial<typeof legacy.design>).subtitleGap;

    expect(migrate(legacy).design.subtitleGap).toBe(3);
  });
});

describe('article image migration', () => {
  it('moves inline figures out of paragraph flow and rejoins split text', () => {
    const legacy = emptyDoc();
    const figureId = uid();
    legacy.assets.photo = {
      src: 'data:image/svg+xml;photo',
      naturalWidth: 800,
      naturalHeight: 400,
    };
    legacy.blocks = [
      { id: 'head', type: 'paragraph', text: 'Before ' },
      { id: figureId, type: 'figure', assetId: 'photo', caption: 'A figure', span: 2 },
      { id: 'tail', type: 'paragraph', text: 'after.', continuationOf: figureId },
    ];
    delete (legacy as Partial<typeof legacy>).images;

    const migrated = migrate(legacy);

    expect(migrated.blocks).toEqual([{ id: 'head', type: 'paragraph', text: 'Before after.' }]);
    expect(migrated.images).toEqual([
      expect.objectContaining({
        id: figureId,
        assetId: 'photo',
        caption: 'A figure',
        widthCols: 2,
        anchor: expect.objectContaining({ page: 1, column: 0 }),
      }),
    ]);
    expect(migrated.assets.photo).toBeDefined();
  });
});
