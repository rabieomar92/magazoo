import { describe, expect, it } from 'vitest';
import { emptyDoc, type Asset, type NewsStory } from '../schema/document';
import { newsPhotoFrameMetrics } from './newsPhotoGeometry';

const design = { ...emptyDoc().design, bodyCols: 4 as const, margin: 15, gutter: 4, heroHeight: 80 };
const asset: Asset = { src: 'data:image/png;base64,example', naturalWidth: 1800, naturalHeight: 900 };
const story: NewsStory = { id: 'story', title: '', text: '', caption: '', source: '', layout: 'compact', widthCols: 2, photoPosition: 'top' };

describe('news image print geometry', () => {
  it('matches two printed columns including the gutter and preserves natural ratio', () => {
    const result = newsPhotoFrameMetrics({ ...story, photoHeight: 0, photoFit: 'contain' }, asset, design);
    expect(result.width).toBe(88);
    expect(result.height).toBe(44);
    expect(result.aspectRatio).toBe(2);
    expect(result.ppi).toBeCloseTo(1800 / (88 / 25.4));
  });
  it('uses the actual image area for contain resolution, and accounts for crop zoom', () => {
    const contained = newsPhotoFrameMetrics({ ...story, photoHeight: 88, photoFit: 'contain' }, asset, design);
    const cropped = newsPhotoFrameMetrics({ ...story, photoHeight: 88, photoFit: 'cover', frame: { scale: 2, offsetX: 0, offsetY: 0 } }, asset, design);
    expect(contained.ppi).toBeCloseTo(1800 / (88 / 25.4));
    expect(cropped.ppi).toBeCloseTo(900 / (88 / 25.4) / 2);
  });
  it('preserves legacy theme heights and supports a resolved legacy pair width', () => {
    expect(newsPhotoFrameMetrics(story, asset, design).height).toBe(64);
    const brief = newsPhotoFrameMetrics({ ...story, widthCols: 1 }, asset, design);
    expect(brief.width).toBe(42);
    expect(brief.height).toBe(44);
    expect(newsPhotoFrameMetrics(story, asset, design, 3).width).toBe(134);
  });
  it('does not claim pixel resolution for vector artwork', () => {
    expect(newsPhotoFrameMetrics(story, { ...asset, src: 'data:image/svg+xml;charset=utf-8,%3Csvg' }, design).ppi).toBeNull();
  });
});
