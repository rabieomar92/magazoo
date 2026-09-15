import type { CSSProperties } from 'react';
import type { Asset, NewsStory } from '../schema/document';
import { newsCustomPhotoHeight } from '../lib/newsPhotoGeometry';
import { FramedImage } from './FramedImage';

interface Props {
  story: NewsStory;
  asset: Asset;
  /** The parent supplies --news-photo-aspect from the real printed frame. */
  preview?: boolean;
}

/** Preserve the source pixels and share exactly one fit/crop between views. */
export function NewsPhoto({ story, asset, preview = false }: Props) {
  const fit = story.photoFit ?? 'cover';
  const naturalRatio = Math.max(1, asset.naturalWidth) / Math.max(1, asset.naturalHeight);
  const style: CSSProperties = { position: 'relative', overflow: 'hidden', width: '100%' };
  if (preview) {
    style.height = 'auto';
    style.aspectRatio = `var(--news-photo-aspect, ${naturalRatio})`;
  } else if (story.photoHeight === 0) {
    style.height = 'auto';
    style.aspectRatio = naturalRatio;
  } else if (story.photoHeight !== undefined && story.photoHeight > 0) {
    style.height = `${newsCustomPhotoHeight(story.photoHeight)}mm`;
  }
  return <div className="news-photo" style={style} data-news-photo-fit={fit}
    role={fit === 'cover' && story.photoAlt ? 'img' : undefined}
    aria-label={fit === 'cover' && story.photoAlt ? story.photoAlt : undefined}>
    {fit === 'contain'
      ? <img src={asset.src} alt={story.photoAlt ?? ''} draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
      : <FramedImage asset={asset} frame={story.frame} />}
  </div>;
}
