import { Fragment, type ReactNode } from 'react';
import type { Doc } from '../schema/document';
import { parseRuns, renderTex } from '../lib/richtext';
import { TagBar } from './TagBar';

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
  return (
    <div className="mag2-head">
      <TagBar doc={doc} pageIndex={0} detail={meta.volume} fullBleed />
      <div className="mag2-head-content">
        {meta.categoryLabel && <p className="mag2-kicker" data-editor-tab="content" data-editor-target="meta-category">{meta.categoryLabel}</p>}
        <h1 className="mag2-title" data-editor-tab="content" data-editor-target="meta-title">{meta.title}</h1>
        {meta.subtitle && <p className="mag2-lede" data-editor-tab="content" data-editor-target="meta-subtitle">{meta.subtitle}</p>}
        <div className="mag2-byline">
          {meta.author && <span className="mag2-author" data-editor-tab="content" data-editor-target="meta-author">{meta.author}</span>}
          {meta.affiliation && <span className="mag2-affil" data-editor-tab="content" data-editor-target="meta-affiliation">{meta.affiliation}</span>}
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
        <blockquote className="mag2-quote" data-editor-tab="content" data-editor-target="meta-pull-quote">
          <span className="mag2-quote-text">{meta.pullQuote}</span>
          {meta.pullQuoteBy && <cite className="mag2-quote-by" data-editor-tab="content" data-editor-target="meta-pull-quote-by">{meta.pullQuoteBy}</cite>}
        </blockquote>
      )}
      {highlights.length > 0 && (
        <aside className="mag2-hl" data-editor-tab="highlights" data-editor-target="highlights">
          <h3 data-editor-tab="highlights" data-editor-target="highlights-label">{meta.highlightsLabel || 'Highlights'}</h3>
          <ul>
            {highlights.map((h, i) => (
              <li key={i}><span className="callout-list-copy">{renderRuns(h)}</span></li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
