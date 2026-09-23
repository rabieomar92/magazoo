import { runsToHtml } from './richtext';

/** Add bookends before pagination so splits carry each mark exactly once.
 * Authored text stays untouched when the style is toggled on or off. */
export function quoteFlowText(text: string, quote?: boolean): string {
  if (!quote || !text.trim()) return text;
  let copy = text.trim();
  const opening = /^(\s*[*_]*\s*)[“"]/;
  const closing = /[”"](\s*[*_]*\s*)$/;
  if (opening.test(copy) && closing.test(copy)) copy = copy.replace(opening, '$1').replace(closing, '$1');
  return `“${copy}”`;
}

export function quoteFlowHtml(text: string, quote?: boolean, opener = false): string {
  if (!quote) return runsToHtml(text, opener);
  let html = runsToHtml(text);
  // The small anchor participates in horizontal wrapping, but has zero height.
  // Only its absolutely positioned glyph is enlarged. Word joiners keep the
  // opening/closing anchors attached to their neighbouring words, even across
  // rich-text tags or a narrow-column line break. They are render-only: never
  // written into the authored paragraph or the pagination input.
  if (text.trimStart().startsWith('“')) html = html.replace('“', '<span class="decorative-quote-mark decorative-quote-mark--open" data-quote="“" aria-hidden="true"><span class="decorative-quote-glyph">“</span></span>&#8288;');
  if (text.trimEnd().endsWith('”')) {
    const end = html.lastIndexOf('”');
    html = `${html.slice(0, end)}&#8288;<span class="decorative-quote-mark decorative-quote-mark--close" data-quote="”" aria-hidden="true"><span class="decorative-quote-glyph">”</span></span>${html.slice(end + 1)}`;
  }
  return `<span class="decorative-quote-copy">${html}</span>`;
}
