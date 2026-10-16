import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { TEMPLATE_META, presetFor } from '../store/presets';
import { backgroundPhotoChoices, canSamplePhotoSource, photoBackgroundColour, photoPointAt, sampledPageDesign } from './photoBackground';

describe('photo background sampling', () => {
  it.each(['png', 'jpeg', 'jpg', 'webp', 'avif', 'gif', 'bmp'])('accepts embedded %s bitmaps', type => {
    expect(canSamplePhotoSource(`data:image/${type};base64,abcd`)).toBe(true);
  });
  it.each(['data:image/svg+xml;utf8,<svg/>', 'javascript:alert(1)', 'https://example.com/photo.jpg', 'blob:photo', '/photo.png', 'data:text/html,<img>'])('does not fetch or decode unsafe/nonembedded sources: %s', src => {
    expect(canSamplePhotoSource(src)).toBe(false);
  });

  it('maps a contained portrait without sampling its side letterboxes', () => {
    const bounds = { left: 10, top: 20, width: 300, height: 200 };
    expect(photoPointAt(160, 120, bounds, 100, 200)).toEqual({ x: .5, y: .5 });
    expect(photoPointAt(110, 20, bounds, 100, 200)).toEqual({ x: 0, y: 0 });
    expect(photoPointAt(100, 120, bounds, 100, 200)).toBeNull();
    expect(photoPointAt(160, 230, bounds, 100, 200)).toBeNull();
  });

  it('maps a wide photograph without sampling top/bottom letterboxes', () => {
    const bounds = { left: 10, top: 20, width: 300, height: 200 };
    expect(photoPointAt(160, 120, bounds, 300, 100)).toEqual({ x: .5, y: .5 });
    expect(photoPointAt(310, 170, bounds, 300, 100)).toEqual({ x: 1, y: 1 });
    expect(photoPointAt(160, 60, bounds, 300, 100)).toBeNull();
  });

  it('rejects unusable geometry instead of generating invalid colours', () => {
    expect(photoPointAt(0, 0, { left: 0, top: 0, width: 0, height: 10 }, 1, 1)).toBeNull();
    expect(photoPointAt(0, 0, { left: 0, top: 0, width: 10, height: 10 }, NaN, 1)).toBeNull();
  });

  it('ignores transparent pixels and chooses the dominant local background, not a foreground average', () => {
    const pixels = [80, 100, 130, 255, 82, 101, 131, 255, 255, 0, 240, 255, 0, 0, 0, 0, 0, 255, 0, 190];
    const before = [...pixels];
    expect(photoBackgroundColour(pixels)?.background).toBe('#516583');
    expect(photoBackgroundColour(pixels)?.ink).toBe('#ffffff');
    expect(pixels).toEqual(before);
    expect(photoBackgroundColour([255, 0, 0, 0])).toBeNull();
  });

  it('chooses dark ink on light sampled colours and light ink on dark ones', () => {
    expect(photoBackgroundColour([230, 240, 250, 255])?.ink).toBe('#000000');
    expect(photoBackgroundColour([20, 30, 40, 255])?.ink).toBe('#ffffff');
  });

  it.each(TEMPLATE_META.map(template => [template.id] as const))('applies a solid colour to %s without changing copy or explicit type settings', templateId => {
    const doc = presetFor(templateId);
    doc.design.pageBackgroundAssetId = 'old-background';
    doc.design.imageTheme = true;
    doc.design.subtitleColor = '#d0a020';
    doc.design.textStyles = { body: { fontWeight: 700, color: '#123456' } };
    const before = JSON.stringify(doc);
    const colour = photoBackgroundColour([80, 100, 130, 255])!;
    const design = sampledPageDesign(doc.design, colour, templateId);
    expect(design.paperBg).toBe('#506482');
    expect(design.colors.hero).toBe('#506482');
    expect(design.colors.ink).toBe('#ffffff');
    expect(design.imageTheme).toBe(false);
    expect(design.pageBackgroundAssetId).toBeUndefined();
    expect(design.subtitleColor).toBe('#d0a020');
    expect(design.textStyles).toEqual(doc.design.textStyles);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('labels image roles without restricting available assets or mutating the document', () => {
    const doc = emptyDoc();
    doc.assets = {
      other: { src: 'data:image/png;base64,a', naturalWidth: 100, naturalHeight: 200 },
      hero: { src: 'data:image/jpeg;base64,b', naturalWidth: 300, naturalHeight: 200 },
      news: { src: 'data:image/webp;base64,c', naturalWidth: 500, naturalHeight: 200 },
    };
    doc.hero.assetId = 'hero';
    doc.news = { stories: [{ id: 'story', title: '', text: '', caption: '', source: '', layout: 'lead', assetId: 'news' }] };
    expect(backgroundPhotoChoices(doc)).toEqual([
      { value: 'hero', label: 'Hero image · 300 × 200' },
      { value: 'news', label: 'News photo 1 · 500 × 200' },
      { value: 'other', label: 'Image 1 · 100 × 200' },
    ]);
  });
});
