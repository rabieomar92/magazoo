import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import { PlacedImages } from './PlacedImages';
import { FramedImage } from '../components/FramedImage';
import { PageArtwork } from '../components/PageArtwork';
import { TagBar } from './TagBar';

/** Magazine page 1: a full-bleed photo cover / masthead. Giant stacked title
 *  with its last word in red, kicker above it, masthead + volume on top, and the
 *  byline / photo credit at the foot over a dark gradient scrim. */
export function MagazineCover({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const { meta, assets } = doc;
  // Page 1 uses the cover image; falls back to the hero for v1 files that never
  // set one, so their look is unchanged.
  const cover = doc.cover ?? doc.hero;
  const photo = doc.design.showHero !== false && cover.assetId ? assets[cover.assetId] : null;
  const words = meta.title.trim().split(/\s+/).filter(Boolean);
  const mag1 = doc.templateId === 'magazine-1';
  const style: CSSProperties = {
    ...vars,
  };

  return (
    <div
      className={`page mag-cover${photo ? ' page--dedicated-bg' : ''}${
        (doc.design.firstPageTopMargin ?? 0) > 0 ? ' page--first-offset' : ''
      }`}
      style={style}
      data-editor-tab={photo ? 'images' : undefined}
      data-editor-target={photo ? 'image-cover' : undefined}
    >
      <PageArtwork doc={doc} />
      {photo && <FramedImage className="mag-cover-photo" asset={photo} frame={cover} />}
      <div className="mag-cover-scrim" />
      <div className="mag-cover-inner">
        <TagBar doc={doc} pageIndex={0} detail={meta.volume} fullBleed />

        <div className="mag-cover-mid">
          {meta.categoryLabel && (
            <p className="mag-kicker" data-editor-tab="content" data-editor-target="meta-category">
              <span className="mag-kicker-dash" />
              {meta.categoryLabel}
            </p>
          )}
          <h1 className="mag-title" data-editor-tab="content" data-editor-target="meta-title">
            {words.map((w, i) => (
              <span
                key={i}
                className={`mag-title-word${i === words.length - 1 ? ' is-accent' : ''}`}
              >
                {w}
              </span>
            ))}
          </h1>
          {meta.subtitle && <p className="mag-lede" data-editor-tab="content" data-editor-target="meta-subtitle">{meta.subtitle}</p>}
        </div>

        <div className="mag-cover-foot">
          <div className="mag-cover-credits">
            {/* magazine-1 shows the raw values; other magazines keep the labels. */}
            {meta.author && <span className="mag-cover-author" data-editor-tab="content" data-editor-target="meta-author">{mag1 ? meta.author : `BY ${meta.author}`}</span>}
            {meta.photoCredit && (
              <span data-editor-tab="content" data-editor-target="meta-photo-credit">{mag1 ? meta.photoCredit : `PHOTO: ${meta.photoCredit}`}</span>
            )}
          </div>
        </div>
      </div>
      <PlacedImages doc={doc} pageIndex={0} />
    </div>
  );
}
