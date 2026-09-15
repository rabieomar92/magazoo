import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDoc } from '../schema/document';
import { cloneDocForUpdate, useDoc } from './useDoc';

afterEach(() => {
  useDoc.getState().load(emptyDoc());
  useDoc.temporal.getState().clear();
  vi.useRealTimers();
});

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
      wrapShape: 'contour',
      wrapContour: { top: [0, 25], bottom: [10, 0] },
    });
    source.highlightBox = {
      widthCols: 2,
      anchor: { page: 1, column: 1, y: 80 },
    };

    const draft = cloneDocForUpdate(source);
    draft.images[0].caption = 'After';
    draft.images[0].anchor.y = 40;
    draft.images[0].bleed!.right = true;
    draft.images[0].wrapContour!.top[1] = 40;
    draft.highlightBox!.anchor.y = 120;
    draft.design.colors.ink = '#fff';

    expect(source.images[0]).toMatchObject({ caption: 'Before', anchor: { y: 20 }, bleed: { left: true } });
    expect(source.images[0].wrapContour?.top).toEqual([0, 25]);
    expect(source.design.colors.ink).not.toBe('#fff');
    expect(source.highlightBox.anchor.y).toBe(80);
    expect(draft.assets.photo).not.toBe(source.assets.photo);
    expect(draft.assets.photo.src).toBe(source.assets.photo.src);
  });

  it('keeps news paragraph spacing and image framing independent of past snapshots', () => {
    const source = emptyDoc();
    source.news = { stories: [{ id: 'story', title: 'Before', text: 'Copy', caption: '', source: '',
      layout: 'compact', paragraphTops: [0, 12], frame: { scale: 1, offsetX: 0, offsetY: 0 } }] };

    const draft = cloneDocForUpdate(source);
    draft.news!.stories[0].paragraphTops![1] = 30;
    draft.news!.stories[0].frame!.offsetX = 20;

    expect(source.news.stories[0].paragraphTops).toEqual([0, 12]);
    expect(source.news.stories[0].frame?.offsetX).toBe(0);
  });

  it('clones structured back-cover social links without sharing row objects', () => {
    const source = emptyDoc();
    source.backCover = {
      qr: { assetId: null, offsetX: 0, offsetY: 0, scale: 1 },
      logo: { assetId: null, offsetX: 0, offsetY: 0, scale: 1 },
      qrLabel: '', brand: 'Brand', tagline: '', website: '', socialLeft: '', socialRight: '',
      socialLinks: [{ id: 'link', platform: 'facebook', url: 'facebook.com/example', label: 'Page', side: 'left' }],
      footerText: '', imprint: '',
    };

    const draft = cloneDocForUpdate(source);
    draft.backCover!.socialLinks![0].url = 'facebook.com/changed';
    draft.backCover!.socialLinks!.push({ id: 'link-2', platform: 'instagram', url: 'instagram.com/example', side: 'right' });

    expect(source.backCover.socialLinks).toHaveLength(1);
    expect(source.backCover.socialLinks![0].url).toBe('facebook.com/example');
    expect(draft.backCover!.socialLinks).toHaveLength(2);
  });

  it('deep-clones nested back-cover layout and per-object typography', () => {
    const source = emptyDoc();
    source.design.backCover = {
      brandTop: 94,
      ruleVisible: true,
      text: {
        brand: { fontFamily: 'Playfair Display', fontSize: 31, color: '#123456' },
        socialUrl: { fontSize: 6.5, visible: true, spaceBefore: -1.5 },
      },
    };

    const draft = cloneDocForUpdate(source);
    draft.design.backCover!.brandTop = 118;
    draft.design.backCover!.text!.brand!.fontSize = 42;
    draft.design.backCover!.text!.brand!.color = '#abcdef';
    draft.design.backCover!.text!.socialUrl!.visible = false;

    expect(draft.design.backCover).not.toBe(source.design.backCover);
    expect(draft.design.backCover!.text).not.toBe(source.design.backCover.text);
    expect(draft.design.backCover!.text!.brand).not.toBe(source.design.backCover.text!.brand);
    expect(source.design.backCover).toMatchObject({
      brandTop: 94,
      text: {
        brand: { fontSize: 31, color: '#123456' },
        socialUrl: { visible: true },
      },
    });
  });
});

describe('document history', () => {
  it('starts a clean undo session when loading a different document', () => {
    useDoc.getState().load(emptyDoc());
    useDoc.getState().update(doc => { doc.meta.title = 'Old issue'; });
    expect(useDoc.temporal.getState().pastStates.length).toBeGreaterThan(0);

    useDoc.getState().load(emptyDoc());
    expect(useDoc.getState().doc.meta.title).toBe('');
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    expect(useDoc.temporal.getState().futureStates).toHaveLength(0);
  });

  it('recovers every rapid edit immediately and preserves redo after timers settle', () => {
    vi.useFakeTimers();
    useDoc.getState().load(emptyDoc());
    useDoc.temporal.getState().clear();
    for (const title of ['A', 'AB', 'ABC']) useDoc.getState().update(doc => { doc.meta.title = title; });

    for (const title of ['AB', 'A', '']) {
      useDoc.temporal.getState().undo();
      expect(useDoc.getState().doc.meta.title).toBe(title);
    }
    vi.runAllTimers();
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    for (const title of ['A', 'AB', 'ABC']) {
      useDoc.temporal.getState().redo();
      expect(useDoc.getState().doc.meta.title).toBe(title);
    }
  });

  it('restores a deleted news story and its image without sharing mutable paragraph spacing', () => {
    const doc = emptyDoc();
    doc.news = { stories: [{ id: 'story', title: 'News', text: 'Copy', caption: '', source: '',
      layout: 'compact', assetId: 'photo', paragraphTops: [0, 12] }] };
    doc.assets.photo = { src: 'data:image/png;base64,example', naturalWidth: 100, naturalHeight: 100 };
    useDoc.getState().load(doc);
    useDoc.temporal.getState().clear();

    useDoc.getState().update(draft => { draft.news!.stories[0].paragraphTops![1] = 30; });
    useDoc.getState().update(draft => { draft.news!.stories = []; delete draft.assets.photo; });
    useDoc.temporal.getState().undo();
    expect(useDoc.getState().doc.news!.stories[0].paragraphTops).toEqual([0, 30]);
    expect(useDoc.getState().doc.assets.photo).toEqual(doc.assets.photo);
    useDoc.temporal.getState().undo();
    expect(useDoc.getState().doc.news!.stories[0].paragraphTops).toEqual([0, 12]);
  });
});
