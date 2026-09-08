import type { NewsStory } from '../schema/document';
import { runsToHtml, splitRichTextAt } from './richtext';

/** `pair` marks the two halves of one band: a side column printed beside the
 * story above it, and that story at its narrowed width. `paragraphCut` says a
 * continuation resumes a paragraph the page break ran through, rather than
 * opening a new one. */
export type NewsPiece = NewsStory & {
  continued?: boolean;
  paragraphCut?: boolean;
  pair?: 'main' | 'aside';
};

/** A blank line opens a new paragraph, exactly as it is typed in the editor.
 * Splitting on the pair alone keeps any further blank lines inside the
 * paragraph that follows, so extra spacing an author typed is preserved. */
const PARAGRAPH_BREAK = '\n\n';

export function newsParagraphs(text: string): string[] {
  return text.split(PARAGRAPH_BREAK);
}

/** The markup for one story's copy. The printed page and the measuring pass
 * both call this, so a paragraph can never be measured as something other than
 * what is printed. Per-paragraph top-to-text spacing is the same control the
 * article templates apply to their paragraphs. */
export function newsCopyHtml(piece: NewsPiece, dropCap = false): string {
  // Every paragraph but the brief's first opens with an indent, which the
  // stylesheet takes care of. A page break is the one case the markup has to
  // state: a paragraph that starts a continuation page is a new paragraph and
  // indents, while the tail of one the break ran through stays flush.
  const opensParagraph = piece.continued && !piece.paragraphCut;
  return newsParagraphs(piece.text)
    .map((paragraph, index) => {
      const top = piece.paragraphTops?.[index];
      const style = top ? ` style="padding-top:${top}px"` : '';
      const indent = index === 0 && opensParagraph ? ' news-para--indent' : '';
      return `<p class="news-para${indent}"${style}>${runsToHtml(paragraph, dropCap && index === 0)}</p>`;
    })
    .join('');
}

/** Re-align paragraph spacing onto a continuation piece. Paragraphs finished on
 * the previous page drop away, and a paragraph cut mid-sentence resumes without
 * repeating its spacing — the same rule the article engine applies to a
 * continued paragraph. */
function carryParagraphTops(piece: NewsPiece, head: string, cut: boolean): number[] | undefined {
  if (!piece.paragraphTops?.length) return undefined;
  const tops = piece.paragraphTops.slice(newsParagraphs(head).length - 1);
  if (cut && tops.length) tops[0] = 0;
  return tops.some(Boolean) ? tops : undefined;
}

/** Layouts that never carry a photograph. */
export function isTextOnly(layout: NewsStory['layout']) {
  return layout === 'text' || layout === 'single' || layout === 'aside';
}

/** A side column shares a band with the story above it. It stands alone when
 * it opens a page, follows another side column, or was told to start a page. */
export function pairsWithPrevious(story: NewsStory | undefined, companion: NewsStory | undefined) {
  return !!story && !!companion && companion.layout === 'aside'
    && story.layout !== 'aside' && !companion.breakBefore;
}

/** Pack whole story rows. Only a story taller than an empty page is split.
 * This engine is independent from article pagination and image exclusions. */
export function packNews(stories: NewsStory[], capacity: number, gap: number,
  measure: (piece: NewsPiece) => number): { pages: NewsPiece[][]; overflow: boolean } {
  const pages: NewsPiece[][] = [[]];
  let used = 0;
  let overflow = false;
  const next = () => { pages.push([]); used = 0; };
  for (let index = 0; index < stories.length; index++) {
    const story = stories[index];
    if (story.breakBefore && used) next();

    // A band is placed whole, so the main story is measured at the width it is
    // actually printed at. A pair too tall for one page keeps the ordinary
    // full-width flow below, where either story may still be continued.
    if (pairsWithPrevious(story, stories[index + 1])) {
      const main: NewsPiece = { ...story, pair: 'main' };
      const aside: NewsPiece = { ...stories[index + 1], pair: 'aside' };
      const band = Math.max(measure(main), measure(aside));
      if (used && used + gap + band > capacity && band <= capacity) next();
      const spacing = used ? gap : 0;
      if (used + spacing + band <= capacity) {
        pages.at(-1)!.push(main, aside);
        used += spacing + band;
        index++;
        continue;
      }
    }

    let piece: NewsPiece = { ...story };
    while (true) {
      const height = measure(piece);
      const spacing = used ? gap : 0;
      if (height + used + spacing <= capacity) {
        pages.at(-1)!.push(piece); used += height + spacing; break;
      }
      if (used) { next(); continue; }
      // Keep original whitespace, paragraph breaks, Arabic words and rich
      // formatting intact across continuation pages.
      const ends = [...piece.text.matchAll(/\S+(?:\s+|$)/gu)].map(m => m.index! + m[0].length);
      let low = 0, high = Math.max(0, ends.length - 1);
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const { head } = splitRichTextAt(piece.text, ends[mid - 1]);
        if (measure({ ...piece, text: head }) <= capacity) low = mid;
        else high = mid - 1;
      }
      if (!low) {
        // A title/photo/caption alone may be too tall. Retain the content and
        // report it instead of silently dropping it or generating endless pages.
        pages.at(-1)!.push(piece); used = height; overflow = true; break;
      }
      const { head, tail } = splitRichTextAt(piece.text, ends[low - 1]);
      if (!tail || tail === piece.text) {
        pages.at(-1)!.push(piece); used = height; overflow = true; break;
      }
      const cut = !head.endsWith(PARAGRAPH_BREAK);
      pages.at(-1)!.push({ ...piece, text: head });
      piece = { ...piece, text: tail, continued: true, paragraphCut: cut,
        paragraphTops: carryParagraphTops(piece, head, cut) };
      next();
    }
  }
  return { pages, overflow };
}
