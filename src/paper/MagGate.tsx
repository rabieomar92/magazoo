import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import { PAGE_H, PAGE_W } from '../lib/geometry';
import { framedSpreadPhoto } from '../lib/magSplit';
import { MagTopBar } from './MagazineHead';
import { PlacedImages } from './PlacedImages';
import { SpreadPhotoImage } from '../components/SpreadPhotoImage';
import { PageArtwork } from '../components/PageArtwork';
import { TagBar } from './TagBar';
import { useGatePlacement } from './useGatePlacement';
import { gateQuoteRule, gateSpacingBleed, gateTypography, gateTypographyCss } from '../lib/gateTypography';
import { pageFooter } from '../lib/pageFooter';

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
  const physicalHalf = doc.design.textDirection === 'rtl' ? 1 - pageIndex : pageIndex;
  return { ...geometry, x: geometry.x - physicalHalf * PAGE_W };
}

/** magazine-3 gatefold, sheet 1 (left half of the photo). Masthead + big stacked
 *  title over a dark scrim; the photo bleeds to the right (fold) edge so it joins
 *  sheet 2. A precisely positioned real image shows the image's left half. */
export function MagGateA({ doc, vars }: { doc: Doc; vars: CSSProperties }) {
  const { meta } = doc;
  const photo = gatePhoto(doc);
  const geometry = gateGeometry(doc, 0);
  const words = meta.title.trim().split(/\s+/).filter(Boolean);
  const placement = useGatePlacement(doc, 'title', vars);
  const bleed = gateSpacingBleed(doc.design, 'title');
  const kickerColor = gateTypography(doc.design, 'kicker').color;
  const naturalTitle = (doc.design.gateTitleLayout ?? (doc.design.textDirection === 'rtl' ? 'natural' : 'stacked')) === 'natural';
  return (
    <div
      className={`page mag-gate mag-gate--a${placement.positioned ? ' mag-gate--positioned' : ''}${photo ? ' page--dedicated-bg' : ''}${
        (doc.design.firstPageTopMargin ?? 0) > 0 ? ' page--first-offset' : ''
      }`}
      style={{ ...vars, ...placement.style, '--gate-title-size': `${doc.design.gateTitleSize ?? 46}pt`, '--mag-kicker-color': kickerColor } as CSSProperties}
      data-editor-tab={photo ? 'images' : undefined}
      data-editor-target={photo ? 'image-cover' : undefined}
    >
      <PageArtwork doc={doc} />
      {photo && geometry && <SpreadPhotoImage asset={photo.asset} geometry={geometry} behind />}
      <div className="mag-gate-scrim mag-gate-scrim--a" />
      <div className="mag-gate-inner" ref={placement.inner}>
        <TagBar doc={doc} pageIndex={0} detail={meta.volume} fullBleed />

        <div className={`mag-gate-mid mag-gate-mid--draggable${placement.drag.dragging ? ' is-dragging' : ''}${bleed < 0 ? ' mag-gate-mid--signed' : ''}`} style={bleed < 0 ? { '--gate-spacing-bleed': `${bleed}px` } as CSSProperties : undefined} ref={placement.mid} {...placement.drag.handlers} title="Drag up or down to place this block" data-editor-tab="design" data-editor-target="gate-title-position">
          {meta.categoryLabel && (
            <p className="mag-kicker" style={gateTypographyCss(doc.design, 'kicker')} data-editor-tab="content" data-editor-target="meta-category">
              <span className="mag-kicker-dash" />
              {meta.categoryLabel}
            </p>
          )}
          <h1 style={gateTypographyCss(doc.design, 'title')} className={`mag-title mag-gate-title${naturalTitle ? ' mag-gate-title--natural' : ''}`} data-editor-tab="content" data-editor-target="meta-title">
            {naturalTitle ? meta.title : words.map((w, i) => (
              <span key={i} className={`mag-title-word${i === words.length - 1 && doc.design.gateAccentLastWord !== false ? ' is-accent' : ''}`}>
                {w}
              </span>
            ))}
          </h1>
        </div>
      </div>
      {placement.overflow && <p className="gate-layout-warning" role="status" data-editor-tab="design" data-editor-target="gate-title-position">Title does not fit. Widen the text box or reduce the title size.</p>}
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
  const placement = useGatePlacement(doc, 'text', vars);
  const bleed = gateSpacingBleed(doc.design, 'text');
  const kickerColor = gateTypography(doc.design, 'kicker').color;
  const quoteRule = gateQuoteRule(doc.design);
  const footerEnabled = pageFooter(doc, 1).enabled;
  return (
    <div
      className={`page mag-gate mag-gate--b${placement.positioned ? ' mag-gate--positioned' : ''}${photo ? ' page--dedicated-bg' : ''}`}
      style={{ ...vars, ...placement.style, '--mag-kicker-color': kickerColor, '--gate-quote-rule': `${quoteRule}px`, '--gate-quote-rule-gap': quoteRule > 0 ? '12px' : '0px' } as CSSProperties}
      data-editor-tab={photo ? 'images' : undefined}
      data-editor-target={photo ? 'image-cover' : undefined}
    >
      {photo && geometry && <SpreadPhotoImage asset={photo.asset} geometry={geometry} behind />}
      <div className="mag-gate-scrim mag-gate-scrim--b" />
      <div className="mag-gate-inner mag-gate-inner--b" ref={placement.inner}>
        {!photo && <MagTopBar doc={doc} pageIndex={1} />}
        <div className={`mag-gate-mid mag-gate-mid--b mag-gate-mid--draggable${placement.drag.dragging ? ' is-dragging' : ''}${bleed < 0 ? ' mag-gate-mid--signed' : ''}`} style={bleed < 0 ? { '--gate-spacing-bleed': `${bleed}px` } as CSSProperties : undefined} ref={placement.mid} {...placement.drag.handlers} title="Drag up or down to place this block" data-editor-tab="design" data-editor-target="gate-text-position">
          {meta.subtitle && <p className="mag-gate-lede" style={gateTypographyCss(doc.design, 'subtitle')} data-editor-tab="content" data-editor-target="meta-subtitle">{meta.subtitle}</p>}
          {meta.pullQuote && (
            <blockquote className="mag-gate-quote" data-editor-tab="content" data-editor-target="meta-pull-quote">
              <span className="mag-gate-quote-text" style={gateTypographyCss(doc.design, 'quote')}>{meta.pullQuote}</span>
              {meta.pullQuoteBy && <cite className="mag-gate-quote-by" style={gateTypographyCss(doc.design, 'attribution')} data-editor-tab="content" data-editor-target="meta-pull-quote-by">{meta.pullQuoteBy}</cite>}
            </blockquote>
          )}
        </div>

        <div className={`mag-gate-foot mag-gate-foot--b${footerEnabled ? '' : ' mag-gate-foot--footer-hidden'}`}>
          <div className="mag-gate-credits">
            {meta.author && <span className="mag-gate-author" style={gateTypographyCss(doc.design, 'author')} data-editor-tab="content" data-editor-target="meta-author">{meta.author}</span>}
            {meta.photoCredit && <span style={gateTypographyCss(doc.design, 'photoCredit')} data-editor-tab="content" data-editor-target="meta-photo-credit">{doc.design.textDirection === 'rtl' ? 'الصورة:' : 'Photo:'} {meta.photoCredit}</span>}
          </div>
        </div>
      </div>
      {placement.overflow && <p className="gate-layout-warning" role="status" data-editor-tab="design" data-editor-target="gate-text-position">Facing-page text does not fit. Widen the box or reduce the text size.</p>}
      <PlacedImages doc={doc} pageIndex={1} />
    </div>
  );
}
