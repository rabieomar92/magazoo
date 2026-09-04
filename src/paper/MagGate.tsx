import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import { PAGE_H, PAGE_W } from '../lib/geometry';
import { framedSpreadPhoto, gatePageBg } from '../lib/magSplit';
import { MagTopBar } from './MagazineHead';
import { PlacedImages } from './PlacedImages';

/** The gatefold photo — the page-1 cover image, split across the two facing cover
 *  sheets. Falls back to the hero for docs that never set a cover. */
function gatePhoto(doc: Doc) {
  if (doc.design.showHero === false) return null;
  const frame = doc.cover ?? doc.hero;
  const asset = frame.assetId ? doc.assets[frame.assetId] : null;
  return asset ? { asset, frame } : null;
}

function gateStyle(doc: Doc, pageIndex: 0 | 1): CSSProperties {
  const photo = gatePhoto(doc);
  if (!photo) return {};
  const ar = photo.asset.naturalHeight > 0
    ? photo.asset.naturalWidth / photo.asset.naturalHeight
    : 16 / 9;
  const geometry = framedSpreadPhoto(ar, PAGE_W * 2, PAGE_H, photo.frame);
  return {
    backgroundImage: `url("${photo.asset.src}")`,
    ...gatePageBg(geometry, pageIndex),
  };
}

/** magazine-3 gatefold, sheet 1 (left half of the photo). Masthead + big stacked
 *  title over a dark scrim; the photo bleeds to the right (fold) edge so it joins
 *  sheet 2. `background-size: 200%` + `position: left` shows the image's left half. */
export function MagGateA({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const { meta } = doc;
  const photo = gatePhoto(doc);
  const words = meta.title.trim().split(/\s+/).filter(Boolean);
  const style: CSSProperties = { ...vars, ...gateStyle(doc, 0) };
  // Sheet 1 of the gatefold is the document's page 1 — same base-side rule as
  // MagazineCover/TagBar's mirror=false case, nothing before it to flip from.
  const flip = doc.design.barSide === 'right';
  return (
    <div
      className={`page mag-gate mag-gate--a${photo ? ' page--dedicated-bg' : ''}${
        (doc.design.firstPageTopMargin ?? 0) > 0 ? ' page--first-offset' : ''
      }`}
      style={style}
    >
      <div className="mag-gate-scrim mag-gate-scrim--a" />
      <div className="mag-gate-inner">
        <div className={`mag-gate-top${flip ? ' mag-gate-top--flip' : ''}`}>
          <span className="mag-masthead">{meta.masthead || meta.affiliation}</span>
          <span className="mag-gate-vol">{meta.volume}</span>
        </div>

        <div className="mag-gate-mid">
          {meta.categoryLabel && (
            <p className="mag-kicker">
              <span className="mag-kicker-dash" />
              {meta.categoryLabel}
            </p>
          )}
          <h1 className="mag-title mag-gate-title">
            {words.map((w, i) => (
              <span key={i} className={`mag-title-word${i === words.length - 1 ? ' is-accent' : ''}`}>
                {w}
              </span>
            ))}
          </h1>
        </div>
      </div>
      <PlacedImages doc={doc} pageIndex={0} />
    </div>
  );
}

/** magazine-3 gatefold, sheet 2 (right half of the photo). Lede + pull-quote +
 *  byline/credit over a scrim; the photo bleeds to the left (fold) edge to meet
 *  sheet 1. `position: right` shows the image's right half. */
export function MagGateB({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const { meta } = doc;
  const photo = gatePhoto(doc);
  const style: CSSProperties = { ...vars, ...gateStyle(doc, 1) };
  return (
    <div className={`page mag-gate mag-gate--b${photo ? ' page--dedicated-bg' : ''}`} style={style}>
      <div className="mag-gate-scrim mag-gate-scrim--b" />
      <div className="mag-gate-inner mag-gate-inner--b">
        {!photo && <MagTopBar doc={doc} pageIndex={1} />}
        <div className="mag-gate-mid mag-gate-mid--b">
          {meta.subtitle && <p className="mag-gate-lede">{meta.subtitle}</p>}
          {meta.pullQuote && (
            <blockquote className="mag-gate-quote">
              <span className="mag-gate-quote-text">{meta.pullQuote}</span>
              {meta.pullQuoteBy && <cite className="mag-gate-quote-by">{meta.pullQuoteBy}</cite>}
            </blockquote>
          )}
        </div>

        <div className="mag-gate-foot mag-gate-foot--b">
          <div className="mag-gate-credits">
            {meta.author && <span>{meta.author}</span>}
            {meta.photoCredit && <span>FOTO: {meta.photoCredit}</span>}
          </div>
        </div>
      </div>
      <PlacedImages doc={doc} pageIndex={1} />
    </div>
  );
}
