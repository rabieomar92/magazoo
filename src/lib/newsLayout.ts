import type {
  NewsColumnCount,
  NewsPhotoPosition,
  NewsRowAlign,
  NewsStory,
} from '../schema/document';
import { DELIMS, parseRuns, runsToHtml } from './richtext';

export type { NewsColumnCount, NewsPhotoPosition, NewsRowAlign } from '../schema/document';

/** `pair` marks the two halves of one band: a side column printed beside the
 * story above it, and that story at its narrowed width. `paragraphCut` says a
 * continuation resumes a paragraph the page break ran through, rather than
 * opening a new one. */
export type NewsPiece = NewsStory & {
  continued?: boolean;
  continues?: boolean;
  paragraphCut?: boolean;
  pair?: 'main' | 'aside';
  /** Computed only while laying out a page; never persisted. */
  gridSpan?: 1 | 2 | 3 | 4;
  /** One-based logical grid column, retained on continuation pages. */
  gridStart?: number;
  row?: number;
};

const clampColumns = (value: number, maximum = 4): NewsColumnCount =>
  Math.min(maximum, Math.max(1, Math.round(value))) as NewsColumnCount;

/** Resolve old preset-only stories and new independently configured stories. */
export function newsStoryWidth(story: NewsStory, pageColumns = 3): NewsColumnCount {
  const columns = clampColumns(pageColumns);
  if (story.widthCols) return clampColumns(story.widthCols, columns);
  return story.layout === 'single' || story.layout === 'aside' ? 1 : columns;
}

export function newsPhotoPosition(story: NewsStory, width = story.widthCols ?? newsStoryWidth(story)): NewsPhotoPosition {
  let position: NewsPhotoPosition = story.photoPosition
    ?? (story.layout === 'lead' || story.layout === 'compact' ? 'right' : 'none');
  // A side-by-side image inside one page column leaves neither part readable.
  if (width === 1 && (position === 'left' || position === 'right')) position = 'top';
  // Preserve the old lead-plus-aside composition: its large photograph sat on
  // top when the lead was narrowed to two page columns.
  if (!story.photoPosition && story.layout === 'lead' && width === 2) position = 'top';
  return position;
}

/** The internal split of a story that places its photograph beside the copy.
 * Lead photographs get the larger share on a three-column page, then settle
 * into a balanced 2+2 composition on a four-column page. Compact cards keep a
 * single photo column so their copy can use the remaining width. */
export function newsCopySpan(
  story: NewsStory,
  width = story.widthCols ?? newsStoryWidth(story),
  photo = newsPhotoPosition(story, width),
): NewsColumnCount {
  if (photo !== 'left' && photo !== 'right') return 1;
  const span = story.photoCols === undefined
    ? story.layout === 'lead' ? Math.floor(width / 2) : width - 1
    : width - clampColumns(story.photoCols, Math.max(1, width - 1));
  return clampColumns(span, width);
}

export function newsPhotoSpan(
  story: NewsStory,
  width = story.widthCols ?? newsStoryWidth(story),
  photo = newsPhotoPosition(story, width),
): NewsColumnCount {
  if (photo !== 'left' && photo !== 'right') return 1;
  return clampColumns(width - newsCopySpan(story, width, photo), width);
}

export function newsTextColumns(
  story: NewsStory,
  width = story.widthCols ?? newsStoryWidth(story),
  photo = newsPhotoPosition(story, width),
): NewsColumnCount {
  const legacy = story.layout === 'text' ? 3
    : story.layout === 'compact' ? 2
    : story.layout === 'lead' && width === 2 && photo === 'top' ? 2
    : 1;
  const requested = clampColumns(story.textCols ?? legacy);
  const maximum = photo === 'left' || photo === 'right'
    ? newsCopySpan(story, width, photo)
    : width;
  return Math.min(requested, maximum) as NewsColumnCount;
}

export function newsRowAlign(story: NewsStory): NewsRowAlign {
  return story.rowAlign ?? (story.widthCols === undefined && story.layout === 'single' ? 'end' : 'start');
}

export function usesNewsGrid(story: NewsStory): boolean {
  return story.widthCols !== undefined || story.textCols !== undefined
    || story.photoPosition !== undefined || story.rowBreakBefore !== undefined
    || story.rowAlign !== undefined || story.photoCols !== undefined;
}

/** Blank lines make paragraphs; hard-wrapped single lines reflow normally. */
const PARAGRAPH_BREAK = /\n[\t ]*\n+/u;
const ENDS_PARAGRAPH = /\n[\t ]*\n+$/u;

export function newsParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/gu, '\n')
    .split(PARAGRAPH_BREAK)
    .map(paragraph => paragraph.replace(/[\t ]*\n[\t ]*/gu, ' '));
}

/** Match the rich-text parser's real open marks, including its unmatched-mark
 * fallback. Counting every star in a prefix would turn literal copy into style
 * whenever a page happened to break after an unmatched asterisk. */
function newsMarkersAt(text: string, offset: number): string[] {
  const open: string[] = [];
  let index = 0;
  while (index < offset) {
    if (text[index] === '$') {
      const close = text.indexOf('$', index + 1);
      if (close !== -1) {
        index = close + 1;
        continue;
      }
    }
    let handled = false;
    for (const { tok } of DELIMS) {
      if (!text.startsWith(tok, index)) continue;
      const active = open.lastIndexOf(tok);
      if (active !== -1) open.splice(active, 1);
      else if (text.indexOf(tok, index + tok.length) !== -1) open.push(tok);
      else continue;
      index += tok.length;
      handled = true;
      break;
    }
    if (!handled) index += 1;
  }
  return open;
}

/** Close/reopen actual formatting without putting a synthetic closing marker
 * in an empty paragraph after the consumed paragraph separator. */
function splitNewsTextAt(text: string, offset: number) {
  const rawHead = text.slice(0, offset);
  const open = newsMarkersAt(text, offset);
  const end = newsMarkersAt(text, text.length);
  const trailing = rawHead.match(/\s*$/u)?.[0] ?? '';
  return {
    rawHead,
    head: rawHead.slice(0, rawHead.length - trailing.length) + [...open].reverse().join('') + trailing,
    // The forgiving parser can leave a style active when a single * found a
    // potential closer inside a later ** token. Balance that existing style
    // at the end too, so a continuation does not reinterpret its opener.
    tail: open.join('') + text.slice(offset) + [...end].reverse().join(''),
  };
}

/** Math expressions stay atomic, and a break never divides ** or __. */
function newsWordBreaks(text: string): number[] {
  const expressions: [number, number][] = [];
  let mathStart = text.indexOf('$');
  while (mathStart !== -1) {
    const mathEnd = text.indexOf('$', mathStart + 1);
    if (mathEnd === -1) break;
    expressions.push([mathStart, mathEnd]);
    mathStart = text.indexOf('$', mathEnd + 1);
  }
  return [...text.matchAll(/\S+(?:\s+|$)/gu)]
    .map(match => match.index! + match[0].length)
    .filter(offset => offset < text.length
      && !expressions.some(([start, end]) => offset > start && offset <= end)
      && !['**', '__'].includes(text.slice(offset - 1, offset + 1)));
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
  const text = piece.text.replace(/\r\n?/gu, '\n');
  const paragraphs = text.split(PARAGRAPH_BREAK);
  const separators = [...text.matchAll(/\n[\t ]*\n+/gu)];
  // A separator carried at a page break belongs to the preceding paragraph;
  // it must not produce an extra empty paragraph at the foot of that page.
  if (piece.continues && paragraphs.at(-1) === '') paragraphs.pop();
  let offset = 0;
  return paragraphs
    .map((paragraph, index) => {
      const before = newsMarkersAt(text, offset);
      const end = offset + paragraph.length;
      const after = newsMarkersAt(text, end);
      const balanced = (before.join('') + paragraph + [...after].reverse().join(''))
        .replace(/[\t ]*\n[\t ]*/gu, ' ');
      offset = end + (separators[index]?.[0].length ?? 0);
      const top = piece.paragraphTops?.[index];
      const style = top ? ` style="padding-top:${top}px"` : '';
      const indent = index === 0 && opensParagraph ? ' news-para--indent' : '';
      return `<p class="news-para${indent}"${style}>${runsToHtml(balanced, dropCap && index === 0)}</p>`;
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
    && story.layout !== 'aside' && !companion.breakBefore
    && !usesNewsGrid(story) && !usesNewsGrid(companion);
}

export type NewsRow = {
  pieces: NewsPiece[];
  pageBreakBefore: boolean;
  legacyPair?: boolean;
};

/**
 * Arrange stories on the selected page grid. Explicit-width stories fill the
 * current row from reading-start to reading-end; a full row or a requested row
 * break starts the next band. Preset-only documents use the original layout.
 */
export function arrangeNewsRows(stories: NewsStory[], pageColumns: NewsColumnCount): NewsRow[] {
  const rows: NewsRow[] = [];
  let pieces: NewsPiece[] = [];
  let columns = 0;
  let pageBreakBefore = false;
  const flush = () => {
    if (!pieces.length) return;
    rows.push({ pieces, pageBreakBefore });
    pieces = [];
    columns = 0;
    pageBreakBefore = false;
  };

  for (let index = 0; index < stories.length; index++) {
    const story = stories[index];
    const companion = stories[index + 1];

    if (pairsWithPrevious(story, companion)) {
      flush();
      rows.push({
        pageBreakBefore: !!story.breakBefore,
        legacyPair: true,
        pieces: [
          { ...story, pair: 'main', gridSpan: clampColumns(pageColumns - 1) },
          { ...companion, pair: 'aside', gridSpan: 1 },
        ],
      });
      index += 1;
      continue;
    }

    // Old preset-only layouts were independent vertical bands. Retain that
    // behaviour until an author touches the new grid controls.
    if (!usesNewsGrid(story)) {
      flush();
      rows.push({
        pageBreakBefore: !!story.breakBefore,
        pieces: [{ ...story, gridSpan: newsStoryWidth(story, pageColumns) }],
      });
      continue;
    }

    const span = newsStoryWidth(story, pageColumns);
    if (story.breakBefore || story.rowBreakBefore || columns + span > pageColumns) flush();
    if (!pieces.length) pageBreakBefore = !!story.breakBefore;
    pieces.push({ ...story, gridSpan: span });
    columns += span;
    if (columns === pageColumns) flush();
  }
  flush();
  for (const band of rows) {
    const occupied = band.pieces.reduce((sum, piece) => sum + piece.gridSpan!, 0);
    const free = Math.max(0, pageColumns - occupied);
    const align = newsRowAlign(band.pieces[0]);
    let start = 1 + (align === 'end' ? free : align === 'center' ? Math.floor(free / 2) : 0);
    for (const piece of band.pieces) {
      piece.gridStart = start;
      start += piece.gridSpan!;
    }
  }
  return rows;
}

function splitNewsPiece(piece: NewsPiece, capacity: number, measure: (piece: NewsPiece, firstRow?: boolean) => number) {
  // A fixed photograph/caption/headline or an oversized final source cannot be
  // repaired by chipping off one word per page. Keep the story intact and let
  // the editor report overflow for that frame.
  if (measure({ ...piece, text: '', paragraphTops: undefined, continues: true }, true) > capacity
    || measure({ ...piece, text: '', paragraphTops: undefined, continued: true, continues: false }, true) > capacity) return null;
  const ends = newsWordBreaks(piece.text);
  let low = 0;
  let high = ends.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const { head } = splitNewsTextAt(piece.text, ends[mid - 1]);
    if (measure({ ...piece, text: head, continues: true }, true) <= capacity) low = mid;
    else high = mid - 1;
  }
  if (!low) return null;
  const { head, tail, rawHead } = splitNewsTextAt(piece.text, ends[low - 1]);
  if (!tail || tail === piece.text || !parseRuns(tail).some(run => run.text.trim())) return null;
  const cut = !ENDS_PARAGRAPH.test(rawHead.replace(/\r\n?/gu, '\n'));
  return {
    head: { ...piece, text: head, continues: true },
    tail: {
      ...piece,
      text: tail,
      continued: true,
      continues: false,
      paragraphCut: cut,
      paragraphTops: carryParagraphTops(piece, rawHead, cut),
    },
  };
}

/** Pack whole story rows. Only a story taller than an empty page is split.
 * This engine is independent from article pagination and image exclusions. */
export function packNews(stories: NewsStory[], capacity: number, gap: number,
  measure: (piece: NewsPiece, firstRow?: boolean) => number,
  pageColumns: NewsColumnCount = 3): { pages: NewsPiece[][]; overflow: boolean } {
  const pages: NewsPiece[][] = [[]];
  let used = 0;
  let overflow = false;
  let row = 0;
  const next = () => { pages.push([]); used = 0; };

  const placeRow = (source: NewsRow) => {
    let pieces = source.pieces;
    if (source.pageBreakBefore && used) next();

    while (pieces.length) {
      const firstRow = used === 0;
      const height = Math.max(...pieces.map(piece => measure(piece, firstRow)));
      const spacing = used ? gap : 0;
      if (used + spacing + height <= capacity) {
        const rowNumber = row++;
        pages.at(-1)!.push(...pieces.map(piece => ({ ...piece, row: rowNumber })));
        used += spacing + height;
        return;
      }
      if (used) {
        next();
        continue;
      }

      // The original paired preset falls back to independent rows when the
      // pair cannot share a page. That preserves its long-standing behaviour.
      if (source.legacyPair) {
        for (const piece of pieces) {
          const span = newsStoryWidth(piece, pageColumns);
          const align = newsRowAlign(piece);
          const free = pageColumns - span;
          placeRow({ pieces: [{ ...piece, pair: undefined, gridSpan: span,
            gridStart: 1 + (align === 'end' ? free : align === 'center' ? Math.floor(free / 2) : 0),
          }], pageBreakBefore: false });
        }
        return;
      }

      // A tall custom row can continue cleanly: each story gets as much of the
      // page as fits, and only unfinished stories reappear on the next page.
      const heads: NewsPiece[] = [];
      const tails: NewsPiece[] = [];
      let impossible = false;
      for (const piece of pieces) {
        if (measure(piece, true) <= capacity) {
          heads.push(piece);
          continue;
        }
        const split = splitNewsPiece(piece, capacity, measure);
        if (!split) {
          heads.push(piece);
          impossible = true;
        } else {
          heads.push(split.head);
          tails.push(split.tail);
        }
      }
      const rowNumber = row++;
      pages.at(-1)!.push(...heads.map(piece => ({ ...piece, row: rowNumber })));
      used = Math.max(...heads.map(piece => measure(piece, true)));
      if (impossible) overflow = true;
      if (!tails.length) return;
      next();
      pieces = tails;
    }
  };

  arrangeNewsRows(stories, pageColumns).forEach(placeRow);
  return { pages, overflow };
}
