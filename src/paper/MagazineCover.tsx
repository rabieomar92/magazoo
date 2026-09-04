import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import { PlacedImages } from './PlacedImages';
import { FramedImage } from '../components/FramedImage';

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
  // The cover is every document's page 1 — the page doc.design.barSide picks
  // a *starting* side for, same convention as TagBar/MagTopBar's `mirror=false`
  // base case. No mirror prop here: there's nothing before it to alternate from.
  const flip = doc.design.barSide === 'right';

  const style: CSSProperties = {
    ...vars,
  };

  return (
    <div
      className={`page mag-cover${photo ? ' page--dedicated-bg' : ''}${
        (doc.design.firstPageTopMargin ?? 0) > 0 ? ' page--first-offset' : ''
      }`}
      style={style}
    >
      {photo && <FramedImage className="mag-cover-photo" asset={photo} frame={cover} />}
      <div className="mag-cover-scrim" />
      <div className="mag-cover-inner">
        <div className={`mag-cover-top${flip ? ' mag-cover-top--flip' : ''}`}>
          <span className="mag-masthead">{meta.masthead}</span>
          <span className="mag-vol">{meta.volume}</span>
        </div>

        <div className="mag-cover-mid">
          {meta.categoryLabel && (
            <p className="mag-kicker">
              <span className="mag-kicker-dash" />
              {meta.categoryLabel}
            </p>
          )}
          <h1 className="mag-title">
            {words.map((w, i) => (
              <span
                key={i}
                className={`mag-title-word${i === words.length - 1 ? ' is-accent' : ''}`}
              >
                {w}
              </span>
            ))}
          </h1>
          {meta.subtitle && <p className="mag-lede">{meta.subtitle}</p>}
        </div>

        <div className="mag-cover-foot">
          <div className="mag-cover-credits">
            {/* magazine-1 shows the raw values; other magazines keep the labels. */}
            {meta.author && <span>{mag1 ? meta.author : `OLEH ${meta.author}`}</span>}
            {meta.photoCredit && (
              <span>{mag1 ? meta.photoCredit : `FOTO: ${meta.photoCredit}`}</span>
            )}
          </div>
        </div>
      </div>
      <PlacedImages doc={doc} pageIndex={0} />
    </div>
  );
}
