import type { Doc } from '../schema/document';
import { FramedImage } from '../components/FramedImage';
import { TagBar } from './TagBar';

/** Magazine pages use the exact same bar structure as paper and gallery pages. */
export function MagTopBar({ doc, pageIndex = 0 }: { doc: Doc; pageIndex?: number }) {
  return <TagBar doc={doc} pageIndex={pageIndex} detail={doc.meta.volume} fullBleed />;
}

/** The page-2 spread header: a full-width hero photo with a location tag, its
 *  credit line, and the pull-quote. Rendered identically in the real spread and
 *  in the hidden measuring host, so the height it reserves is always exact. */
export function MagazineHead({ doc }: { doc: Doc }) {
  const { meta, hero, assets, design } = doc;
  const photo = design.showHero !== false && hero.assetId ? assets[hero.assetId] : null;
  // magazine-1 drops the "PHOTO —" label and prints the credit as-is.
  const mag1 = doc.templateId === 'magazine-1';
  return (
    <div className="mag-head">
      {photo && (
        <figure className="mag-hero" data-editor-tab="images" data-editor-target="image-hero">
          <FramedImage asset={photo} frame={hero} />
          {meta.location && <figcaption className="mag-hero-tag" data-editor-tab="content" data-editor-target="meta-location">{meta.location}</figcaption>}
        </figure>
      )}
      {photo && meta.photoCredit && (
        <p className="mag-hero-credit" data-editor-tab="content" data-editor-target="meta-photo-credit">{mag1 ? meta.photoCredit : `PHOTO — ${meta.photoCredit}`}</p>
      )}
      {meta.pullQuote && (
        <blockquote className="mag-quote" data-editor-tab="content" data-editor-target="meta-pull-quote">
          <span className="mag-quote-text">{meta.pullQuote}</span>
          {meta.pullQuoteBy && <cite className="mag-quote-by" data-editor-tab="content" data-editor-target="meta-pull-quote-by">{meta.pullQuoteBy}</cite>}
        </blockquote>
      )}
    </div>
  );
}
