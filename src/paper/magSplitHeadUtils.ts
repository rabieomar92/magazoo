import type { Doc } from '../schema/document';

/** Highlights rendered in magazine-2's fixed aside (free-placement boxes stay
 * in the page flow instead). */
export function splitAsideHighlights(doc: Doc): string[] {
  if (!doc.design.sidebar || doc.design.highlightsPlacement === 'free') return [];
  return doc.highlights.filter((highlight) => highlight.trim());
}
