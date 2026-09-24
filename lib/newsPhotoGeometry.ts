import type { Asset, Design, NewsStory } from '../schema/document';
import { PAGE_W } from './geometry';
import { normalizeImageFrame } from './imageFrame';
import { newsPhotoPosition, newsPhotoSpan, newsStoryWidth } from './newsLayout';

export function newsCustomPhotoHeight(height: number): number {
  return Math.min(220, Math.max(15, Number.isFinite(height) ? height : 60));
}

/** Physical dimensions shared by the preview and print-resolution check. */
export function newsPhotoFrameMetrics(
  story: NewsStory,
  asset: Asset,
  design: Design,
  storyColumns = newsStoryWidth(story, design.bodyCols),
) {
  const position = newsPhotoPosition(story, storyColumns);
  const photoColumns = position === 'left' || position === 'right'
    ? newsPhotoSpan(story, storyColumns, position)
    : storyColumns;
  const columnWidth = (PAGE_W - 2 * design.margin - (design.bodyCols - 1) * design.gutter) / design.bodyCols;
  const width = Math.max(.1, columnWidth * photoColumns + (photoColumns - 1) * design.gutter);
  const sourceWidth = asset.naturalWidth > 0 ? asset.naturalWidth : 1;
  const sourceHeight = asset.naturalHeight > 0 ? asset.naturalHeight : 1;
  const legacyHeight = design.heroHeight * (storyColumns === 1 ? .55 : story.layout === 'compact' ? .8 : 1);
  const height = story.photoHeight === 0
    ? width * sourceHeight / sourceWidth
    : story.photoHeight !== undefined && story.photoHeight > 0
      ? newsCustomPhotoHeight(story.photoHeight)
      : Math.max(.1, legacyHeight);
  const fit = story.photoFit ?? 'cover';
  const scale = fit === 'contain'
    ? Math.min(width / sourceWidth, height / sourceHeight)
    : Math.max(width / sourceWidth, height / sourceHeight) * normalizeImageFrame(story.frame).scale;
  const vector = /^data:image\/svg\+xml(?:[;,]|$)/iu.test(asset.src);
  // Pixels per inch refers to the printed pixels after fitting and zooming,
  // rather than dividing the source width by an unrelated sidebar preview.
  const ppi = vector || !asset.naturalWidth || !asset.naturalHeight
    ? null
    : 25.4 / scale;
  return { width, height, aspectRatio: width / height, ppi, vector };
}
