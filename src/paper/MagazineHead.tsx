import type { Doc } from '../schema/document';
import { barStartsRight } from '../lib/barSide';

/** The masthead rule every spread page opens with — the same "always exists"
 *  bar as the paper templates' TagBar, in the magazine's own thin-rule idiom
 *  (matching .mag-cover-top / .mag-gate-top). Fixed height (`--bar-h`, same
 *  var the paper bar uses), so it costs nothing to account for in the height
 *  formulas beyond one more constant. `doc.design.barSide` picks which end
 *  the masthead starts on; the volume/date sits at the other end. `mirror`
 *  (page-index-derived, same convention as TagBar) flips that for the sheet,
 *  so the masthead alternates left/right/left/right down the spread. */
export function MagTopBar({ doc, pageIndex = 0 }: { doc: Doc; pageIndex?: number }) {
  const flip = barStartsRight(doc.design.barSide, pageIndex);
  return (
    <div className={`mag-topbar${flip ? ' mag-topbar--flip' : ''}`}>
      <span className="mag-topbar-mast">{doc.meta.masthead || doc.meta.affiliation}</span>
      <span className="mag-topbar-vol">{doc.meta.volume}</span>
    </div>
  );
}

/** The page-2 spread header: a full-width hero photo with a location tag, its
 *  credit line, and the pull-quote. Rendered identically in the real spread and
 *  in the hidden measuring host, so the height it reserves is always exact. */
export function MagazineHead({ doc }: { doc: Doc }) {
  const { meta, hero, assets, design } = doc;
  const photo = design.showHero !== false && hero.assetId ? assets[hero.assetId] : null;
  // magazine-1 drops the "FOTO —" label and prints the credit as-is.
  const mag1 = doc.templateId === 'magazine-1';
  return (
    <div className="mag-head">
      {photo && (
        <figure className="mag-hero">
          <img src={photo.src} alt="" />
          {meta.location && <figcaption className="mag-hero-tag">{meta.location}</figcaption>}
        </figure>
      )}
      {photo && meta.photoCredit && (
        <p className="mag-hero-credit">{mag1 ? meta.photoCredit : `FOTO — ${meta.photoCredit}`}</p>
      )}
      {meta.pullQuote && (
        <blockquote className="mag-quote">
          <span className="mag-quote-text">{meta.pullQuote}</span>
          {meta.pullQuoteBy && <cite className="mag-quote-by">{meta.pullQuoteBy}</cite>}
        </blockquote>
      )}
    </div>
  );
}
