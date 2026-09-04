import { Fragment, type ReactNode } from 'react';
import type { Doc } from '../schema/document';
import { parseRuns, renderTex } from '../lib/richtext';

/** Inline **bold** / *italic* / __underline__ + `$…$` math → styled nodes.
 *  Same helper as Flow.tsx/GalleryPage.tsx's own copy — highlights are short
 *  author text, not worth threading a shared import for. */
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

/** The highlights + references content, shared by the right rail (Sidebar) and
 *  the full-width end-of-article block (HighlightsBody in a .hl-below wrapper). */
export function HighlightsBody({ doc, hideRefs = false }: { doc: Doc; hideRefs?: boolean }) {
  const highlights = doc.highlights.filter((h) => h.trim());
  return (
    <>
      <h3>{doc.meta.highlightsLabel || 'Highlights'}</h3>
      <ul className="highlights">
        {highlights.map((h, i) => (
          <li key={i}>{renderRuns(h)}</li>
        ))}
      </ul>
      {!hideRefs && doc.references.length > 0 && (
        <>
          <h3>{doc.meta.referencesLabel || 'References'}</h3>
          <ol className="references">
            {doc.references.map((r) => (
              <li key={r.id}>
                {r.authors} ({r.year}). {r.title}. <em>{r.journal}</em>.
                {r.doi && <> doi:{r.doi}</>}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

export function Sidebar({ doc }: { doc: Doc }) {
  return (
    <aside className="sidebar" data-image-avoiding-callout>
      <span className="sidebar-image-shape" aria-hidden="true" />
      <HighlightsBody doc={doc} />
    </aside>
  );
}
