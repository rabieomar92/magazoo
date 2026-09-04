import { Fragment, type ReactNode } from 'react';
import type { Doc } from '../schema/document';
import { parseRuns, renderTex } from '../lib/richtext';

/** Inline **bold** / *italic* / __underline__ + `$…$` math → styled nodes.
 *  Same helper as Flow.tsx/GalleryPage.tsx/Sidebar.tsx's own copy. */
function renderRuns(text: string): ReactNode {
  return parseRuns(text).map((r, j) => {
    if (r.math)
      return <span key={j} className="tex" dangerouslySetInnerHTML={{ __html: renderTex(r.text) }} />;
    let node: ReactNode = r.text;
    if (r.b) node = <strong>{node}</strong>;
    if (r.i) node = <em>{node}</em>;
    if (r.u) node = <u>{node}</u>;
    return <Fragment key={j}>{node}</Fragment>;
  });
}

/** magazine-2 masthead band + title block. Rendered identically in the real
 *  sheet and in the hidden measuring host, so the height it steals from the
 *  body columns is always exact. */
export function MagSplitHead({ doc }: { doc: Doc }) {
  const { meta } = doc;
  // Sheet 1 is the document's page 1 — same base-side rule as MagazineCover/
  // MagGateA/TagBar's mirror=false case: barSide picks the starting side directly.
  const flip = doc.design.barSide === 'right';
  return (
    <div className="mag2-head">
      <div className={`mag2-band${flip ? ' mag2-band--flip' : ''}`}>
        <span className="mag2-band-mast">{meta.masthead}</span>
        <span className="mag2-band-vol">{meta.volume}</span>
      </div>
      <div className="mag2-head-content">
        {meta.categoryLabel && <p className="mag2-kicker">{meta.categoryLabel}</p>}
        <h1 className="mag2-title">{meta.title}</h1>
        {meta.subtitle && <p className="mag2-lede">{meta.subtitle}</p>}
        <div className="mag2-byline">
          {meta.author && <span className="mag2-author">{meta.author}</span>}
          {meta.affiliation && <span className="mag2-affil">{meta.affiliation}</span>}
        </div>
      </div>
    </div>
  );
}

/** The foot of magazine-2's sheet 1: pull-quote, then the highlights box. Also
 *  measured (its height comes off the body box, same as the head). */
export function MagSplitAside({ doc }: { doc: Doc }) {
  const highlights =
    doc.design.highlightsPlacement === 'free'
      ? []
      : doc.highlights.filter((h) => h.trim());
  const { meta } = doc;
  if (!meta.pullQuote && !highlights.length) return null;
  return (
    <div className="mag2-aside">
      {meta.pullQuote && (
        <blockquote className="mag2-quote">
          <span className="mag2-quote-text">{meta.pullQuote}</span>
          {meta.pullQuoteBy && <cite className="mag2-quote-by">{meta.pullQuoteBy}</cite>}
        </blockquote>
      )}
      {highlights.length > 0 && (
        <aside className="mag2-hl">
          <h3>{meta.highlightsLabel || 'Highlights'}</h3>
          <ul>
            {highlights.map((h, i) => (
              <li key={i}>{renderRuns(h)}</li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
