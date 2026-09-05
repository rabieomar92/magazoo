import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import { PAGE_H, PAGE_W } from '../lib/geometry';
import { framedSpreadPhoto } from '../lib/magSplit';
import { MagTopBar } from './MagazineHead';
import { PlacedImages } from './PlacedImages';
import { SpreadPhotoImage } from '../components/SpreadPhotoImage';
import { PageArtwork } from '../components/PageArtwork';
import { TagBar } from './TagBar';

/** The gatefold photo — the page-1 cover image, split across the two facing cover
 *  sheets. Falls back to the hero for docs that never set a cover. */
function gatePhoto(doc: Doc) {
  if (doc.design.showHero === false) return null;
  const frame = doc.cover ?? doc.hero;
  const asset = frame.assetId ? doc.assets[frame.assetId] : null;
  return asset ? { asset, frame } : null;
}

function gateGeometry(doc: Doc, pageIndex: 0 | 1) {
  const photo = gatePhoto(doc);
  if (!photo) return null;
  const ar = photo.asset.naturalHeight > 0
    ? photo.asset.naturalWidth / photo.asset.naturalHeight
    : 16 / 9;
  const geometry = framedSpreadPhoto(ar, PAGE_W * 2, PAGE_H, photo.frame);
  return { ...geometry, x: geometry.x - pageIndex * PAGE_W };
}

/** magazine-3 gatefold, sheet 1 (left half of the photo). Masthead + big stacked
 *  title over a dark scrim; the photo bleeds to the right (fold) edge so it joins
 *  sheet 2. A precisely positioned real image shows the image's left half. */
export function MagGateA({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const { meta } = doc;
  const photo = gatePhoto(doc);
  const geometry = gateGeometry(doc, 0);
  const words = meta.title.trim().split(/\s+/).filter(Boolean);
  return (
    <div
      className={`page mag-gate mag-gate--a${photo ? ' page--dedicated-bg' : ''}${
        (doc.design.firstPageTopMargin ?? 0) > 0 ? ' page--first-offset' : ''
      }`}
      style={vars}
    >
      <PageArtwork doc={doc} />
      {photo && geometry && <SpreadPhotoImage asset={photo.asset} geometry={geometry} behind />}
      <div className="mag-gate-scrim mag-gate-scrim--a" />
      <div className="mag-gate-inner">
        <TagBar doc={doc} pageIndex={0} detail={meta.volume} fullBleed />

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
 *  sheet 1. A precisely positioned real image shows the image's right half. */
export function MagGateB({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const { meta } = doc;
  const photo = gatePhoto(doc);
  const geometry = gateGeometry(doc, 1);
  return (
    <div className={`page mag-gate mag-gate--b${photo ? ' page--dedicated-bg' : ''}`} style={vars}>
      {photo && geometry && <SpreadPhotoImage asset={photo.asset} geometry={geometry} behind />}
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
