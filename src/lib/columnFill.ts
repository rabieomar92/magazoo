/**
 * True `column-fill: auto` for a page's flowing columns: fill column 1 to the
 * box's full height before spilling to column 2, and so on — only the truly
 * last column may end up short.
 *
 * That is what the CSS property is spec'd to do given a definite box height,
 * but Chromium doesn't reliably do it: it silently behaves like `balance`
 * (spread content evenly, leave a trailing column empty) whenever the content
 * fits within the box without overflowing it — which describes every single
 * document's last page, by construction of paginate.ts's fillOne() (it only
 * ever stops adding content to a page once one more item WOULD overflow).
 * Confirmed empirically (a standalone Chromium test, several CSS variants —
 * overflow, height-via-min/max, wrapper nesting — none of them change it); no
 * CSS-only fix exists.
 *
 * The fix that does work: force explicit column breaks at the exact points a
 * correct sequential fill would choose, computed the same way paginate.ts
 * already finds a PAGE break — binary-search how much fits, splitting a
 * straddling paragraph at a word boundary — just bounded by one column's
 * height instead of the whole page. `break-before: column` on the piece that
 * should open each new column is enough; the browser still lays out
 * everything else (line wrapping, column-fill:auto for whatever's left in a
 * given column) exactly as it already does, correctly, once it isn't asked to
 * decide the WHOLE box's distribution in one shot.
 *
 * Scope: text plus single-column figures. Those figures are ordinary atoms in
 * the same reading flow, so they can be measured inside one column and receive
 * the same explicit break marker as a paragraph. A wider figure/equation is a
 * row-spanning object with different height accounting and remains outside
 * this pass; Flow.tsx balances the text bands around those rows separately.
 */
import { runsToHtml, openMarkers } from './richtext';
import type { Piece } from './paginate';
import type { Doc } from '../schema/document';

type TextPiece = Extract<Piece, { kind: 'text' }>;
type FigurePiece = Extract<Piece, { kind: 'figure' }>;
type InlinePiece = TextPiece | FigurePiece;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** jsdom never computes layout — scrollHeight/clientHeight are always 0 there.
 *  Every function below takes `isOverflowing` as an injectable parameter
 *  (default: the real check) for exactly that reason — same convention
 *  paginate.ts's own overflows()/paginateHosts() use. Tests inject a fake.
 *
 *  Named for what it's used for (a probe pinned to one column), not for which
 *  axis it reads: it checks BOTH, same as paginate.ts's own `overflows()`.
 *  An earlier version of this function checked scrollHeight alone, on the
 *  reasoning that "a single-column probe never spills sideways" — that's
 *  wrong. `column-count: 1` on a box with a definite (fixed) block-size is
 *  only a preference for one column when everything fits; content taller
 *  than that one column still fragments into further columns laid out
 *  sideways past the box's own width, exactly like the `column-span: all`
 *  case paginate.ts's header comment and textWrap.ts's own comment describe
 *  (scrollWidth moves, scrollHeight stays flush with the fixed height, so a
 *  height-only check silently reports "fits" for content that's actually
 *  several columns' worth too long). Confirmed empirically: a probe this
 *  module pinned to one column, fed a paragraph several times its height,
 *  reported scrollHeight === clientHeight while scrollWidth grew by a whole
 *  extra (phantom, off-screen) column per overflow-column's worth of text. */
/** `scrollHeight` is integer-rounded in Chromium, while line boxes and an
 * absolutely clipped image segment retain fractional geometry. That means the
 * old scroll-only test could admit a final line whose descenders/Arabic marks
 * extended a fraction of a pixel beyond the writable rectangle. Read the real
 * glyph-line rectangles as well, so "fits" always means every painted glyph
 * fits — not merely that the rounded scroll metrics agree. */
export function hasClippedTextLine(el: HTMLElement): boolean {
  const bounds = el.getBoundingClientRect();
  if (!bounds.height || !el.clientHeight || typeof document.createRange !== 'function') return false;
  const renderedScale = el.offsetHeight ? bounds.height / el.offsetHeight : 1;
  const contentBottom = bounds.top + (el.clientTop + el.clientHeight) * (renderedScale || 1);
  const epsilon = 0.2;

  for (const paragraph of Array.from(el.querySelectorAll('p'))) {
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    if (typeof range.getClientRects !== 'function') continue;
    for (const line of Array.from(range.getClientRects())) {
      if (line.width > 0 && line.height > 0 && line.bottom > contentBottom + epsilon) return true;
    }
  }
  return false;
}

export const overflowsY = (el: HTMLElement) =>
  el.scrollHeight > el.clientHeight + 1 ||
  el.scrollWidth > el.clientWidth + 1 ||
  hasClippedTextLine(el);

/** Render plain paragraphs into a single-column probe, mirroring Flow.tsx's
 *  TextP exactly (opener/drop-cap, indent/cont classing, marker-safe HTML) so
 *  the measured wrap matches the real render in both LTR and RTL scripts. */
function paintText(el: HTMLElement, items: TextPiece[], opener = false) {
  el.innerHTML = '';
  for (const [itemIndex, it] of items.entries()) {
    const p = document.createElement('p');
    const isOpener = opener && itemIndex === 0;
    const classes = [
      isOpener ? 'flow-opener' : '',
      it.cont
        ? 'cont'
        : it.indent === true
          ? 'indent-on'
          : it.indent === false
            ? 'indent-off'
            : '',
    ].filter(Boolean);
    if (classes.length) p.className = classes.join(' ');
    if (it.fontSize !== undefined) p.style.fontSize = `${it.fontSize}pt`;
    if (it.color) p.style.color = it.color;
    if (!it.cont && it.topPadding !== undefined) p.style.paddingTop = `${it.topPadding}px`;
    p.innerHTML = runsToHtml(it.text, isOpener);
    el.appendChild(p);
  }
}

/** Same as paintText(), but also applies the `colBreak` piece's real
 *  `break-before: column` inline style (see Flow.tsx's TextP) instead of
 *  ignoring it. Used only to verify a candidate colBreak stamping against a
 *  genuine multi-column box — fillColumns()'s own probe above is pinned to
 *  `column-count: 1` and never carries a colBreak style at all, so it can
 *  only ever check "does this slice fit in one column in isolation," not
 *  "does the browser's real multi-column engine honor these exact break
 *  points without spilling a column past `fcols`." Those two occasionally
 *  disagree (confirmed empirically: a --railed continuation page whose
 *  single-column probe reported everything fits still overflowed sideways,
 *  by a whole extra column, once actually rendered with the stamps applied)
 *  — see columnizePage()'s own comment for where this is called from. */
function paintStamped(el: HTMLElement, items: TextPiece[]) {
  el.innerHTML = '';
  for (const [itemIndex, it] of items.entries()) {
    const p = document.createElement('p');
    const classes = [
      itemIndex === 0 ? 'flow-opener' : '',
      it.cont
        ? 'cont'
        : it.indent === true
          ? 'indent-on'
          : it.indent === false
            ? 'indent-off'
            : '',
    ].filter(Boolean);
    if (classes.length) p.className = classes.join(' ');
    if (it.colBreak) {
      p.style.breakBefore = 'column';
      p.style.setProperty('-webkit-column-break-before', 'always');
    }
    if (it.fontSize !== undefined) p.style.fontSize = `${it.fontSize}pt`;
    if (it.color) p.style.color = it.color;
    if (!it.cont && it.topPadding !== undefined) p.style.paddingTop = `${it.topPadding}px`;
    p.innerHTML = runsToHtml(it.text, itemIndex === 0);
    el.appendChild(p);
  }
}

/** Paint `out` (already colBreak-stamped) into the REAL multi-column `host` —
 *  still the hidden measuring twin at this point, so this costs one more
 *  invisible layout pass, no flicker — and report whether it genuinely fits.
 *  `host`'s own column-count/width/height are already the real ones (only
 *  `probe` above gets resized to a single column), so scrollWidth/scrollHeight
 *  here read exactly what the visible page would. Restores `host`'s prior
 *  content afterward since it's a shared, reused element. */
function fitsStamped(host: HTMLElement, out: TextPiece[]): boolean {
  const prev = host.innerHTML;
  paintStamped(host, out);
  const ok = !overflowsY(host);
  host.innerHTML = prev;
  return ok;
}

/** Binary-search the word boundary where `straddle` overflows the probe,
 *  given everything in `before` already placed — same technique as
 *  paginate.ts's fillOne(). `isOverflowing` is whatever the caller passed in
 *  (overflowsY by default, which — see its own comment — checks both axes;
 *  a single-column probe can still spill sideways). */
function splitAt(
  probe: HTMLElement,
  before: TextPiece[],
  straddle: TextPiece,
  isOverflowing: (el: HTMLElement) => boolean,
  opener: boolean,
): { placed: TextPiece[]; tail: TextPiece | null } {
  const w = words(straddle.text);
  let lo = 0,
    hi = w.length,
    best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    paintText(probe, [
      ...before,
      { ...straddle, text: w.slice(0, mid).join(' '), indent: straddle.indent },
    ], opener);
    if (!isOverflowing(probe)) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  let head = w.slice(0, best).join(' ');
  let tail = w.slice(best).join(' ');
  if (head && tail) {
    const open = openMarkers(head);
    head += [...open].reverse().join('');
    tail = open.join('') + tail;
  }
  const isCont = Boolean(head);
  return {
    placed: [
      ...before,
      ...(head ? [{ ...straddle, text: head, indent: straddle.indent } satisfies TextPiece] : []),
    ],
    tail: tail
      ? {
          ...straddle,
          text: tail,
          cont: isCont || straddle.cont,
          indent: isCont ? undefined : straddle.indent,
          colBreak: undefined,
        }
      : null,
  };
}

/** Split `items` into `fcols` columns, each filled to `probe`'s full height
 *  before spilling to the next. `probe` must already be sized to ONE column
 *  (its own width/height set by the caller).
 *
 *  Every column, including the last, gets the same bounded-fit treatment —
 *  whatever doesn't fit even in the last column comes back as `remainder`
 *  rather than being silently force-fit (content lost or overflowing).
 *  columnizePage()'s own caller never expects a remainder (paginate.ts has
 *  already guaranteed the whole page fits in `fcols` columns of this height),
 *  but textWrap.ts's caller genuinely needs it — it's only handing this
 *  function ONE band's worth of a page, not the whole page. */
export function fillColumns(
  items: TextPiece[],
  probe: HTMLElement,
  fcols: number,
  isOverflowing: (el: HTMLElement) => boolean = overflowsY,
): { columns: TextPiece[][]; remainder: TextPiece[] } {
  const columns: TextPiece[][] = [];
  let rest = items;
  let opened = false;

  while (rest.length && columns.length < fcols) {
    paintText(probe, rest, !opened);
    if (!isOverflowing(probe)) {
      // Everything left fits in one column — it's the true last column's worth.
      columns.push(rest);
      rest = [];
      break;
    }

    let n = rest.length;
    while (n > 0) {
      n--;
      paintText(probe, rest.slice(0, n), !opened);
      if (!isOverflowing(probe)) break;
    }

    const { placed, tail } = splitAt(
      probe,
      rest.slice(0, n),
      rest[n],
      isOverflowing,
      !opened,
    );
    if (placed.length) {
      columns.push(placed);
      rest = [...(tail ? [tail] : []), ...rest.slice(n + 1)];
      opened = true;
    } else {
      // Progress guard: not even one word of the straddling paragraph fits —
      // force it onto this column whole rather than loop forever (mirrors
      // paginate.ts's own guard for a page-length item).
      columns.push([rest[0]]);
      rest = rest.slice(1);
      opened = true;
    }
  }
  while (columns.length < fcols) columns.push([]);
  return { columns, remainder: rest };
}

export interface ColumnExclusion {
  top: number;
  bottom: number;
}

/** Merge overlapping image bands before turning them into one CSS shape. */
export function mergeExclusions(exclusions: ColumnExclusion[]): ColumnExclusion[] {
  const sorted = exclusions
    .map(({ top, bottom }) => ({ top: Math.max(0, top), bottom: Math.max(0, bottom) }))
    .filter(({ top, bottom }) => bottom > top)
    .sort((a, b) => a.top - b.top);
  const merged: ColumnExclusion[] = [];
  for (const band of sorted) {
    const previous = merged.at(-1);
    if (previous && band.top <= previous.bottom) previous.bottom = Math.max(previous.bottom, band.bottom);
    else merged.push({ ...band });
  }
  return merged;
}

/** Alpha-gradient used as a CSS shape: opaque bands exclude text while the
 * transparent portions above, between and below them remain writable. */
export function exclusionGradient(exclusions: ColumnExclusion[]): string {
  const merged = mergeExclusions(exclusions);
  if (!merged.length) return 'none';
  const stops = ['transparent 0px'];
  for (const { top, bottom } of merged) {
    stops.push(`transparent ${top}px`, `#000 ${top}px`, `#000 ${bottom}px`, `transparent ${bottom}px`);
  }
  stops.push('transparent 100%');
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

function splitTextRegion(
  probe: HTMLElement,
  before: TextPiece[],
  straddle: TextPiece,
  isOverflowing: (el: HTMLElement) => boolean,
  opener: boolean,
): { placed: TextPiece[]; tail: TextPiece | null } {
  const content = words(straddle.text);
  let lo = 0;
  let hi = content.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    paintText(probe, [
      ...before,
      { ...straddle, text: content.slice(0, mid).join(' '), exclusions: undefined },
    ], opener);
    if (!isOverflowing(probe)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  let head = content.slice(0, best).join(' ');
  let tail = content.slice(best).join(' ');
  if (head && tail) {
    const open = openMarkers(head);
    head += [...open].reverse().join('');
    tail = open.join('') + tail;
  }
  const continued = Boolean(head);
  return {
    placed: [
      ...before,
      ...(head ? [{ ...straddle, text: head, exclusions: undefined } satisfies TextPiece] : []),
    ],
    tail: tail
        ? {
          ...straddle,
          text: tail,
          cont: continued || straddle.cont,
          indent: continued ? undefined : straddle.indent,
          exclusions: undefined,
        }
      : null,
  };
}

export interface FilledImageSegment {
  order: number;
  top: number;
  bottom: number;
  pieces: TextPiece[];
}

export interface FilledImageColumn {
  segments: FilledImageSegment[];
}

/** Return the concrete writable rectangles left between image bands. */
export function writableSegments(
  exclusions: ColumnExclusion[],
  columnHeight: number,
): { top: number; bottom: number }[] {
  const segments: { top: number; bottom: number }[] = [];
  let cursor = 0;
  for (const exclusion of mergeExclusions(exclusions)) {
    const top = Math.min(columnHeight, Math.max(0, exclusion.top));
    const bottom = Math.min(columnHeight, Math.max(top, exclusion.bottom));
    if (top > cursor) segments.push({ top: cursor, bottom: top });
    cursor = Math.max(cursor, bottom);
  }
  if (cursor < columnHeight) segments.push({ top: cursor, bottom: columnHeight });
  return segments;
}

/** Fill one ordinary rectangular text region. Unlike fillColumns(), a region
 * too short for one word is allowed to remain empty; the same text then tries
 * the next region below the image (or the next column). */
function fillTextRegion(
  items: TextPiece[],
  probe: HTMLElement,
  isOverflowing: (el: HTMLElement) => boolean,
  opener: boolean,
): { placed: TextPiece[]; remainder: TextPiece[] } {
  if (!items.length) return { placed: [], remainder: [] };
  paintText(probe, items, opener);
  if (!isOverflowing(probe)) return { placed: items, remainder: [] };

  let count = items.length;
  while (count > 0) {
    count -= 1;
    paintText(probe, items.slice(0, count), opener);
    if (!isOverflowing(probe)) break;
  }
  const straddle = items[count];
  if (!straddle) return { placed: [], remainder: items };
  const { placed, tail } = splitTextRegion(
    probe,
    items.slice(0, count),
    straddle,
    isOverflowing,
    opener,
  );
  if (!placed.length) return { placed: [], remainder: items };
  return {
    placed,
    remainder: [...(tail ? [tail] : []), ...items.slice(count + 1)],
  };
}

/** Fill explicit rectangles in magazine reading order: finish every writable
 * segment of the leading logical column from top to bottom, then advance to
 * the next column. An image at the top of column 1 therefore sends the opening
 * copy directly below itself; the story can never jump to column 2 and later
 * return beneath the image. PaperPreview maps physical columns into logical
 * order first, so this same loop reads right-to-left for RTL documents. */
export function fillColumnsAroundImages(
  items: TextPiece[],
  probe: HTMLElement,
  exclusionsByColumn: ColumnExclusion[][],
  columnHeight: number,
  isOverflowing: (el: HTMLElement) => boolean = overflowsY,
  safetyBoost = 0,
): { columns: FilledImageColumn[]; remainder: TextPiece[] } {
  const columns: FilledImageColumn[] = exclusionsByColumn.map(() => ({ segments: [] }));
  let rest: TextPiece[] = items.map((item) => ({
    ...item,
    colBreak: undefined,
    exclusions: undefined,
  }));
  let opened = false;
  let segmentOrder = 0;

  // Browser line boxes can end on a fractional device pixel. scrollHeight is
  // integer-rounded, while the absolutely clipped visible segment is not; a
  // line that measures as an exact fit can therefore lose its descenders (and
  // in Arabic/Jawi, joining marks) at an image boundary. Keep a tiny fraction
  // of one real line in reserve. Injected-layout unit tests have no computed
  // line-height, so their deterministic capacity remains unchanged.
  const computed = getComputedStyle(probe);
  const lineHeight = Number.parseFloat(computed.lineHeight);
  const segmentSafety =
    (Number.isFinite(lineHeight) ? Math.min(4, Math.max(2, lineHeight * 0.16)) : 0) +
    Math.max(0, safetyBoost);

  const mergedByColumn = exclusionsByColumn.map(mergeExclusions);
  for (let columnIndex = 0; columnIndex < mergedByColumn.length; columnIndex += 1) {
    const segments = writableSegments(mergedByColumn[columnIndex], columnHeight);
    for (const bounds of segments) {
      const height = bounds.bottom - bounds.top;
      if (height <= 0) continue;
      probe.style.height = `${Math.max(0, height - segmentSafety)}px`;
      const filled = fillTextRegion(rest, probe, isOverflowing, !opened);
      columns[columnIndex].segments.push({ ...bounds, order: segmentOrder, pieces: filled.placed });
      segmentOrder += 1;
      rest = filled.remainder;
      if (filled.placed.length) opened = true;
    }
  }
  probe.style.height = `${columnHeight}px`;
  return { columns, remainder: rest };
}

/** Image-aware equivalent of findBalancedHeight(). On the last page, find the
 * shortest common vertical finish line that still accommodates every word in
 * the actual free rectangles. Earlier pages continue to consume their full
 * capacity; only the genuine article ending is balanced. */
export function findBalancedImageHeight(
  items: TextPiece[],
  probe: HTMLElement,
  exclusionsByColumn: ColumnExclusion[][],
  maxHeight: number,
  isOverflowing: (el: HTMLElement) => boolean = overflowsY,
  safetyBoost = 0,
): number {
  const fitsAt = (height: number) =>
    fillColumnsAroundImages(
      items,
      probe,
      exclusionsByColumn,
      height,
      isOverflowing,
      safetyBoost,
    ).remainder.length === 0;

  if (maxHeight <= 0 || !fitsAt(maxHeight)) return Math.max(0, maxHeight);
  let lo = 0;
  let hi = maxHeight;
  // Eight passes are enough for sub-line precision on an A4 body while keeping
  // image dragging/form editing responsive.
  for (let pass = 0; pass < 8 && hi - lo > 1; pass += 1) {
    const mid = (lo + hi) / 2;
    if (fitsAt(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** True when a figure is an ordinary one-column flow atom. Wider figures are
 * row spanners and must keep the banded layout handled by Flow.tsx. */
function isInlineFigure(piece: Piece, doc: Doc): piece is FigurePiece {
  if (piece.kind !== 'figure') return false;
  const block = doc.blocks.find((candidate) => candidate.id === piece.id);
  return block?.type === 'figure' && block.span === 1 && Boolean(doc.assets[block.assetId]);
}

/** Render a one-column slice exactly like the visible flow. The placeholder
 * includes the image's aspect-ratio height AND its real caption, so the break
 * calculation cannot treat caption lines as free space. */
function paintInlineFlow(el: HTMLElement, items: InlinePiece[], doc: Doc, opener: boolean) {
  el.innerHTML = '';
  for (const [itemIndex, it] of items.entries()) {
    if (it.kind === 'text') {
      const p = document.createElement('p');
      const isOpener = opener && itemIndex === 0;
      const classes = [
        isOpener ? 'flow-opener' : '',
        it.cont
          ? 'cont'
          : it.indent === true
            ? 'indent-on'
            : it.indent === false
              ? 'indent-off'
              : '',
      ].filter(Boolean);
      if (classes.length) p.className = classes.join(' ');
      if (it.fontSize !== undefined) p.style.fontSize = `${it.fontSize}pt`;
      if (it.color) p.style.color = it.color;
      if (!it.cont && it.topPadding !== undefined) p.style.paddingTop = `${it.topPadding}px`;
      p.innerHTML = runsToHtml(it.text, isOpener);
      el.appendChild(p);
      continue;
    }

    const block = doc.blocks.find((candidate) => candidate.id === it.id);
    if (!block || block.type !== 'figure') continue;
    const asset = doc.assets[block.assetId];
    if (!asset?.naturalWidth) continue;

    const fig = document.createElement('figure');
    const wrap = block.wrap && block.wrap !== 'none' ? block.wrap : null;
    if (wrap) {
      const side = block.pos === 'right' ? 'right' : 'left';
      fig.className = `flow-fig flow-fig--col flow-fig--wrap flow-fig--wrap-${side}`;
    } else {
      fig.className = 'flow-fig flow-fig--col';
    }
    el.appendChild(fig);

    const media = document.createElement('div');
    media.className = 'flow-fig-measure-media';
    const width = fig.offsetWidth || el.clientWidth;
    media.style.height = `${width * (asset.naturalHeight / asset.naturalWidth)}px`;
    fig.appendChild(media);
    if (block.caption.trim()) {
      const caption = document.createElement('figcaption');
      caption.style.textAlign = block.align ?? 'left';
      caption.innerHTML = runsToHtml(block.caption);
      fig.appendChild(caption);
    }
  }
}

function splitInlineAt(
  probe: HTMLElement,
  before: InlinePiece[],
  straddle: TextPiece,
  doc: Doc,
  opener: boolean,
  isOverflowing: (el: HTMLElement) => boolean,
): { placed: InlinePiece[]; tail: TextPiece | null } {
  const w = words(straddle.text);
  let lo = 0;
  let hi = w.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    paintInlineFlow(
      probe,
      [
        ...before,
        {
          ...straddle,
          text: w.slice(0, mid).join(' '),
          colBreak: undefined,
        },
      ],
      doc,
      opener,
    );
    if (!isOverflowing(probe)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  let head = w.slice(0, best).join(' ');
  let tail = w.slice(best).join(' ');
  if (head && tail) {
    const open = openMarkers(head);
    head += [...open].reverse().join('');
    tail = open.join('') + tail;
  }
  const isCont = Boolean(head);
  return {
    placed: [
      ...before,
      ...(head
        ? [{ ...straddle, text: head, colBreak: undefined } satisfies TextPiece]
        : []),
    ],
    tail: tail
        ? {
          ...straddle,
          text: tail,
          cont: isCont || straddle.cont,
          indent: isCont ? undefined : straddle.indent,
          colBreak: undefined,
        }
      : null,
  };
}

/** Sequentially fill columns containing text and ordinary one-column figures.
 * This is deliberately separate from fillColumns(): textWrap.ts depends on
 * that function's text-only contract for the side tracks beside a spanner. */
export function fillInlineColumns(
  items: InlinePiece[],
  doc: Doc,
  probe: HTMLElement,
  fcols: number,
  isOverflowing: (el: HTMLElement) => boolean = overflowsY,
): { columns: InlinePiece[][]; remainder: InlinePiece[] } {
  const columns: InlinePiece[][] = [];
  let rest = items;

  while (rest.length && columns.length < fcols) {
    const opener = columns.length === 0;
    paintInlineFlow(probe, rest, doc, opener);
    if (!isOverflowing(probe)) {
      columns.push(rest);
      rest = [];
      break;
    }

    let n = rest.length;
    while (n > 0) {
      n--;
      paintInlineFlow(probe, rest.slice(0, n), doc, opener);
      if (!isOverflowing(probe)) break;
    }

    const straddle = rest[n];
    if (straddle?.kind === 'text') {
      const { placed, tail } = splitInlineAt(
        probe,
        rest.slice(0, n),
        straddle,
        doc,
        opener,
        isOverflowing,
      );
      if (placed.length) {
        columns.push(placed);
        rest = [...(tail ? [tail] : []), ...rest.slice(n + 1)];
      } else {
        columns.push([rest[0]]);
        rest = rest.slice(1);
      }
    } else if (n > 0) {
      // Figures are atomic: when the next one does not fit, finish this column
      // with the preceding copy and open the next column with the whole image.
      columns.push(rest.slice(0, n));
      rest = rest.slice(n);
    } else {
      // Taller than a full column. Preserve progress and let the page's normal
      // overflow safety net surface the exceptional asset instead of looping.
      columns.push([rest[0]]);
      rest = rest.slice(1);
    }
  }

  while (columns.length < fcols) columns.push([]);
  return { columns, remainder: rest };
}

/** Read a box's own column geometry (count, width, height) exactly the way
 *  paginate.ts's paint() derives colW — from the box's real computed style —
 *  so the probe measures at the same width the real column wraps at. */
function readColumnGeometry(host: HTMLElement): { fcols: number; colW: number; colH: number } {
  const cs = getComputedStyle(host);
  const gap = parseFloat(cs.columnGap) || 0;
  const fcols = parseInt(cs.columnCount, 10) || 1;
  const colW = fcols > 1 ? (host.clientWidth - (fcols - 1) * gap) / fcols : host.clientWidth;
  return { fcols, colW, colH: host.clientHeight };
}

/** Stamp `colBreak` onto whichever piece should open each new column, for one
 *  page. Pages holding a figure/equation, or a box with 1 column, pass
 *  through untouched. `probe` is a shared, reusable hidden element (from the
 *  measure-root rig) that this function resizes and classes to match `host`
 *  for each call. */
export function columnizePage(
  pieces: Piece[],
  host: HTMLElement | null | undefined,
  probe: HTMLElement | null | undefined,
  doc?: Doc,
): Piece[] {
  if (!host || !probe) return pieces;
  const textOnly = pieces.every((piece) => piece.kind === 'text');
  const inlineCompatible =
    Boolean(doc) && pieces.every((piece) => piece.kind === 'text' || isInlineFigure(piece, doc!));
  if (!textOnly && !inlineCompatible) return pieces;
  const { fcols, colW, colH } = readColumnGeometry(host);
  if (fcols <= 1 || !colW || !colH) return pieces;

  // Inherit the host's own classes so `.body-cols p` / `.mag-cols p` /
  // `.indent-on` etc. apply — font size, line-height, hyphens, paragraph
  // margins and indents all come from those selectors, not this function.
  // width/height/column-count are then pinned by inline style, which always
  // wins over the class's own (var-driven) rules for the same properties.
  probe.className = host.className;
  probe.style.width = `${colW}px`;
  probe.style.height = `${colH}px`;
  // A fixed-height `column-count: 1` box is still allowed to create implicit
  // overflow columns to the side in Chromium. Use an ordinary single block
  // formatting context so excess copy grows scrollHeight instead.
  probe.style.setProperty('column-count', 'initial');
  probe.style.setProperty('column-width', 'auto');
  probe.style.overflow = 'hidden';

  const { columns, remainder } = textOnly
    ? fillColumns(pieces as TextPiece[], probe, fcols)
    : fillInlineColumns(pieces as InlinePiece[], doc!, probe, fcols);
  // Should never happen here — paginate.ts already guaranteed this page's
  // content fits in `fcols` columns of this height, using the real browser's
  // simultaneous multi-column layout. This function instead re-derives the
  // same break points by probing one column at a time in isolation, which is
  // occasionally a pixel or a word off from that real layout (accumulated
  // hyphenation/justification rounding over several columns of real content,
  // confirmed empirically on a many-column, text-heavy page). A non-empty
  // remainder means this run is one of those disagreements — tacking it onto
  // the end with no column info used to be the fallback here, but the browser
  // then has nowhere left to put it (every explicit column is already marked
  // "full") and spills it sideways past the page's own edge: a real, visible
  // overflow, worse than the ragged-but-safe layout this whole module exists
  // to improve on. Bail to the untouched input instead — this one page skips
  // the sequential-fill polish and falls back to Chromium's native (imperfect
  // but bounds-safe) column balancing, exactly like `withColFill`'s own
  // try/catch falls back one level up.
  if (remainder.length) return pieces;
  // Verify the exact concrete tracks that Flow.tsx will render. Rechecking
  // forced breaks inside Chromium's native multicolumn fragmenter can reject
  // a valid explicit-grid split because that engine tries to balance the
  // breaks again. The independent one-column probe is the authoritative
  // geometry for this sequential renderer, including inline figures.
  const columnsFit = columns.every((column, columnIndex) => {
    if (textOnly) paintText(probe, column as TextPiece[], columnIndex === 0);
    else paintInlineFlow(probe, column as InlinePiece[], doc!, columnIndex === 0);
    return !overflowsY(probe);
  });
  if (!columnsFit) return pieces;
  const out: Piece[] = [];
  columns.forEach((col, ci) => {
    col.forEach((p, pi) => {
      // `false` on the very first piece is an intentional render marker: a
      // short page that needs only one column has no true break, but it still
      // must use Flow.tsx's explicit grid or Chromium will balance that copy
      // thinly across every available track.
      out.push(pi === 0 ? { ...p, colBreak: ci > 0 } : p);
    });
  });
  return out;
}

/** Apply columnizePage across every page of a document, given the same
 *  `hosts` array (and clamp-to-last-host convention) paginate.ts's own
 *  paginateHosts() uses — pages beyond hosts.length reuse the last host. */
export function columnizeAll(
  pages: Piece[][],
  hosts: (HTMLElement | null | undefined)[],
  probe: HTMLElement | null | undefined,
  doc?: Doc,
): Piece[][] {
  if (!hosts.length) return pages;
  const hostAt = (i: number) => hosts[Math.min(i, hosts.length - 1)];
  return pages.map((pcs, i) => columnizePage(pcs, hostAt(i), probe, doc));
}

/** Per-pagination-region image bands, indexed by physical text column. */
export type PageImageExclusions = Record<number, ColumnExclusion[][]>;

/**
 * Image-aware counterpart to columnizeAll(). Starting at the first affected
 * page, text is reflowed through every column's actual writable shape. Words
 * displaced by an image are carried to the next page instead of remaining
 * underneath the absolute image overlay.
 */
export function columnizeAllAroundImages(
  pages: Piece[][],
  hosts: (HTMLElement | null | undefined)[],
  probe: HTMLElement | null | undefined,
  pageExclusions: PageImageExclusions,
  doc?: Doc,
  safetyBoost = 0,
): Piece[][] {
  if (!hosts.length || !probe) return pages;
  const affected = Object.keys(pageExclusions).map(Number).filter(Number.isFinite);
  if (!affected.length) return columnizeAll(pages, hosts, probe, doc);
  const firstAffected = Math.min(...affected);
  const hostAt = (index: number) => hosts[Math.min(index, hosts.length - 1)];
  const output: Piece[][] = [];
  let carry: Piece[] = [];
  const total = Math.max(pages.length, firstAffected + 1);

  for (let pageIndex = 0; pageIndex < total || carry.length; pageIndex += 1) {
    const host = hostAt(pageIndex);
    const original = pages[pageIndex] ?? [];
    if (!host) {
      output.push([...carry, ...original]);
      carry = [];
      continue;
    }
    if (pageIndex < firstAffected) {
      output.push(columnizePage(original, host, probe, doc));
      continue;
    }

    const input = [...carry, ...original];
    carry = [];
    const { fcols, colW, colH } = readColumnGeometry(host);
    if (fcols < 1 || !colW || !colH) {
      output.push(input);
      continue;
    }
    probe.className = host.className;
    probe.style.width = `${colW}px`;
    probe.style.height = `${colH}px`;
    probe.style.setProperty('column-count', 'initial');
    probe.style.setProperty('column-width', 'auto');
    probe.style.overflow = 'hidden';

    const configured = pageExclusions[pageIndex] ?? [];
    const exclusions = Array.from({ length: fcols }, (_, column) => configured[column] ?? []);
    const hasObstacleHere = exclusions.some((column) => column.length);
    if (input.some((piece) => piece.kind !== 'text')) {
      if (!hasObstacleHere) {
        // Once displaced mixed content reaches an obstacle-free continuation
        // page, hand it back to the ordinary atomic layout unchanged.
        output.push(columnizePage(input, host, probe, doc));
        continue;
      }

      // A shaped column cannot safely split an equation/full-width figure.
      // Fill every leading paragraph around the image, then carry the atom and
      // everything after it to the next page as one ordered tail. This is the
      // conservative guarantee: an atomic block may cause an earlier page
      // break, but no paragraph is ever left in the image's paint rectangle.
      const atomIndex = input.findIndex((piece) => piece.kind !== 'text');
      const leading = input.slice(0, atomIndex) as TextPiece[];
      const filled = fillColumnsAroundImages(
        leading,
        probe,
        exclusions,
        colH,
        overflowsY,
        safetyBoost,
      );
      carry = [...filled.remainder, ...input.slice(atomIndex)];
      output.push([
        {
          kind: 'image-columns',
          height: colH,
          columns: filled.columns.map((column) => ({
            segments: column.segments.map((segment) => ({
              ...segment,
              pieces: segment.pieces.map(({ kind, sourceId, text, cont, indent, fontSize, color, topPadding }) => ({
                kind,
                sourceId,
                text,
                cont,
                indent,
                fontSize,
                color,
                topPadding,
              })),
            })),
          })),
        },
      ]);
      continue;
    }

    const filled = fillColumnsAroundImages(
      input as TextPiece[],
      probe,
      exclusions,
      colH,
      overflowsY,
      safetyBoost,
    );
    carry = filled.remainder;
    output.push([
      {
        kind: 'image-columns',
        height: colH,
        columns: filled.columns.map((column) => ({
          segments: column.segments.map((segment) => ({
            ...segment,
            pieces: segment.pieces.map(({ kind, sourceId, text, cont, indent, fontSize, color, topPadding }) => ({
              kind,
              sourceId,
              text,
              cont,
              indent,
              fontSize,
              color,
              topPadding,
            })),
          })),
        })),
      },
    ]);

    // There is no source page after this one, but displaced copy still needs a
    // real destination. The loop condition creates continuation pages until
    // every word has found writable space.
    if (pageIndex >= pages.length - 1 && !carry.length) break;
  }
  return output;
}

/**
 * Balanced fill (Design panel's "Column fill: Balanced"): find the SHORTEST
 * per-column height that still fits every item into `fcols` columns, instead
 * of always filling to the box's full `maxH`. A page whose text doesn't reach
 * the bottom of the box — most commonly a document's last page, the one
 * sequential fill leaves visibly ragged (column 1 running to the floor,
 * column 4 stopping halfway) — ends up with all its columns bottoming out at
 * (approximately) the same line instead, the classic magazine "even column
 * bottoms" look.
 *
 * There's no formula for this: paragraph breaks, hyphenation and indent are
 * all real measurements against the same probe fillColumns() itself uses, so
 * the only way to answer "does it fit at height H" is to actually lay it out
 * at H and check. Binary search over H (from 0 to `maxH`) converges on the
 * tightest fit in ~20 layout passes — `maxH` itself is always a valid answer
 * (that's the height paginate.ts already proved this content fits at), so the
 * search only ever narrows downward from a known-good starting point.
 *
 * fillColumns()'s own success signal (an empty `remainder`) isn't trusted on
 * its own: its documented "progress guard" can force a whole straddling piece
 * into a column without re-checking overflow, right when a candidate H is too
 * small for even one word to fit — exactly the false "it fits" a naive
 * remainder-only check would hit early in the search. Each candidate is
 * re-verified column by column instead.
 */
export function findBalancedHeight(
  items: TextPiece[],
  probe: HTMLElement,
  fcols: number,
  maxH: number,
  isOverflowing: (el: HTMLElement) => boolean = overflowsY,
): number {
  const fitsAt = (h: number): boolean => {
    probe.style.height = `${h}px`;
    const { columns, remainder } = fillColumns(items, probe, fcols, isOverflowing);
    if (remainder.length) return false;
    return columns.every((col, columnIndex) => {
      paintText(probe, col, columnIndex === 0);
      return !isOverflowing(probe);
    });
  };

  if (maxH <= 0 || !fitsAt(maxH)) return Math.max(0, maxH);

  let lo = 0;
  let hi = maxH;
  // Halves a several-thousand-px range to sub-pixel precision well within 24
  // iterations; stop as soon as the window is under a pixel.
  for (let i = 0; i < 24 && hi - lo > 1; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (fitsAt(mid)) hi = mid;
    else lo = mid + 1;
  }
  return hi;
}

/** Balanced-fill version of columnizePage: same contract and same text-only
 *  scope, but targets findBalancedHeight()'s tightest common height instead
 *  of the box's full height. */
export function columnizePageBalanced(
  pieces: Piece[],
  host: HTMLElement | null | undefined,
  probe: HTMLElement | null | undefined,
  doc?: Doc,
): Piece[] {
  if (!host || !probe) return pieces;
  if (pieces.some((p) => p.kind !== 'text')) return columnizePage(pieces, host, probe, doc);
  const { fcols, colW, colH } = readColumnGeometry(host);
  if (fcols <= 1 || !colW || !colH) return pieces;

  probe.className = host.className;
  probe.style.width = `${colW}px`;
  probe.style.setProperty('column-count', 'initial');
  probe.style.setProperty('column-width', 'auto');
  probe.style.overflow = 'hidden';

  const balancedH = findBalancedHeight(pieces as TextPiece[], probe, fcols, colH);
  probe.style.height = `${balancedH}px`;
  const { columns, remainder } = fillColumns(pieces as TextPiece[], probe, fcols);
  // Same bail as columnizePage(): a non-empty remainder here means either
  // findBalancedHeight() couldn't find a height that fits everything (its own
  // fallback is maxH, i.e. colH — the full box — so this mirrors "doesn't
  // even fit at full height") or the single-column simulation and the real
  // multi-column layout disagreed by a hair. Either way, tacking the
  // remainder on with no column info risks a real sideways page overflow;
  // falling back to the untouched (unbalanced but bounds-safe) input is the
  // one wrong-looking-but-never-broken outcome.
  if (remainder.length) return pieces;
  const out: Piece[] = [];
  columns.forEach((col, ci) => {
    col.forEach((p, pi) => {
      out.push(pi === 0 ? { ...p, colBreak: ci > 0 } : p);
    });
  });
  // Keep the verified bounds-safe fallback when the browser's native
  // fragmenter disagrees with the independently measured balanced split.
  if (!fitsStamped(host, out as TextPiece[])) return pieces;
  return out;
}

/** Balanced-fill version of columnizeAll — same hosts/probe contract. */
export function columnizeAllBalanced(
  pages: Piece[][],
  hosts: (HTMLElement | null | undefined)[],
  probe: HTMLElement | null | undefined,
  doc?: Doc,
): Piece[][] {
  if (!hosts.length) return pages;
  const hostAt = (i: number) => hosts[Math.min(i, hosts.length - 1)];
  return pages.map((pcs, i) => columnizePageBalanced(pcs, hostAt(i), probe, doc));
}
