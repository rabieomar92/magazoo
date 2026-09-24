/**
 * Real text-wrap beside a partial-width figure — "2 columns wide" leaves the
 * OTHER columns still carrying text, instead of the whole row clearing like
 * `column-span: all` normally forces.
 *
 * Why this is scoped, not general: CSS has no way to keep some columns
 * flowing text beside a spanning element — `column-span` is only `none` or
 * `all`. The only way around that is to stop using `column-span` for these
 * rows and hand-place the figure and its neighbouring text in a CSS Grid
 * instead (see Flow.tsx's 'wrap-row' branch and page.css's `.flow-wraprow`).
 * The composite remains a `column-span: all` row in the outer article flow,
 * so it is safe wherever the figure lands: copy before it forms the preceding
 * column row and copy after it is measured into the row's unused grid tracks.
 * This also handles centred figures by giving each free physical track its own
 * text box instead of pretending the two separated sides are one multicolumn
 * region.
 *
 * Safety: this is pure REARRANGEMENT of a page's already-decided pieces —
 * never adds or drops content, and never runs the pagination search again.
 * It's safe to run after paginate.ts has already committed to "this content
 * fits on this page" because moving some of the text that would have started
 * only below the figure up beside it instead can only reduce the vertical
 * space the page's content needs, never increase it. If a page's content
 * fit before, it still fits (with room to spare) after.
 */
import type { Doc } from '../schema/document';
import { overflows, type Piece } from './paginate';
import { fillColumns } from './columnFill';
import { parseRuns, runsToHtml } from './richtext';

type TextPiece = Extract<Piece, { kind: 'text' }>;

function figureGeometry(doc: Doc, id: string) {
  const block = doc.blocks.find((b) => b.id === id);
  if (!block || block.type !== 'figure') return null;
  const asset = doc.assets[block.assetId];
  if (!asset) return null;
  const widthBasis = block.span === 'bleed' ? 'body' : block.span;
  if (widthBasis === 1 || widthBasis === 'body') return null; // not a partial spanner
  return {
    n: widthBasis as 2 | 3 | 4,
    pos: block.pos ?? 'center',
    aspect: asset.naturalHeight / asset.naturalWidth,
    caption: block.caption,
    bleed: block.bleed === true || block.span === 'bleed',
  };
}

/** Same height formula paint() uses for a figure block: width-derived, plus
 *  a caption allowance. `w` here is the figure's own rendered width (its N
 *  columns + the gutters between them), not one column's width. */
function figureHeightPx(
  probe: HTMLElement,
  imageW: number,
  captionW: number,
  aspect: number,
  caption: string,
): number {
  const previous = {
    className: probe.className,
    width: probe.style.width,
    height: probe.style.height,
    columns: probe.style.getPropertyValue('column-count'),
    columnWidth: probe.style.getPropertyValue('column-width'),
    overflow: probe.style.overflow,
  };
  // A bled image grows past its assigned tracks, but its caption deliberately
  // stays inside the figure's track width. Measuring both at the enlarged
  // image width made long captions look one line shorter to the wrapper than
  // they really rendered, so the side copy stopped too early (or collided).
  probe.style.width = `${captionW}px`;
  probe.style.height = 'auto';
  probe.style.setProperty('column-count', 'initial');
  probe.style.setProperty('column-width', 'auto');
  probe.style.overflow = 'visible';
  probe.innerHTML = '';
  const fig = document.createElement('figure');
  fig.className = 'flow-fig flow-wraprow-fig';
  const media = document.createElement('div');
  media.className = 'flow-fig-measure-media';
  media.style.height = `${imageW * aspect}px`;
  fig.appendChild(media);
  if (caption.trim()) {
    const cap = document.createElement('figcaption');
    cap.innerHTML = runsToHtml(caption);
    fig.appendChild(cap);
  }
  probe.appendChild(fig);
  const measured = fig.offsetHeight || imageW * aspect;
  probe.innerHTML = '';
  probe.className = previous.className;
  probe.style.width = previous.width;
  probe.style.height = previous.height;
  probe.style.setProperty('column-count', previous.columns);
  probe.style.setProperty('column-width', previous.columnWidth);
  probe.style.overflow = previous.overflow;
  return measured;
}

/**
 * Rewrites `pieces` so each partial-width figure becomes a
 * `wrap-row` piece (figure + the next stretch of text, in whichever columns
 * it doesn't cover) instead of a lone spanner. `probe` is resized per figure —
 * same shared, reusable element columnFill.ts's columnizePage() uses.
 *
 * Overflow check: paginate.ts's `overflows()` (both scrollWidth AND
 * scrollHeight) — same both-axes check columnFill.ts's own `overflowsY` uses
 * too (its earlier, height-only version had exactly the gap this comment
 * used to warn about here: a fixed-height multicolumn box, even pinned to
 * `column-count: 1`, doesn't grow `scrollHeight` when content overflows —
 * Chromium spills a phantom extra column sideways instead, `scrollWidth`
 * moving while `scrollHeight` stays flush with the box's own height). This
 * probe is deliberately measured against a SHORT box (the figure's own
 * height, often much less than a full column), which made the miss common
 * here specifically — but it turned out just as reachable from columnFill.ts's
 * own full-column-height probes (any page needing more than one column's
 * worth of text overflows a single column's height by definition), so both
 * now share the same fix rather than one relying on a "rarely happens" box
 * height it can't actually count on.
 */
export function wrapPartialFigures(
  pieces: Piece[],
  doc: Doc,
  fcols: number,
  colW: number,
  gutter: number,
  probe: HTMLElement | null | undefined,
  isOverflowing: (el: HTMLElement) => boolean = overflows,
  rtl = false,
  rightEdgeIsFree = true,
): Piece[] {
  if (!probe || fcols < 2) return pieces;

  const out: Piece[] = [];
  let i = 0;

  while (i < pieces.length) {
    const p = pieces[i];

    if (p.kind === 'equation') {
      out.push(p);
      i++;
      continue;
    }

    if (p.kind === 'figure') {
      const geo = figureGeometry(doc, p.id);
      if (geo && geo.n < fcols) {
        const start =
          geo.pos === 'left' ? 0 : geo.pos === 'right' ? fcols - geo.n : Math.floor((fcols - geo.n) / 2);
        const physicalFree = Array.from({ length: fcols }, (_, col) => col).filter(
          (col) => col < start || col >= start + geo.n,
        );
        const readingFree = rtl ? [...physicalFree].reverse() : physicalFree;
        const edgeBleed =
          geo.bleed && (geo.pos === 'left' || (geo.pos === 'right' && rightEdgeIsFree));
        const captionW = geo.n * colW + (geo.n - 1) * gutter;
        const figW = captionW + (edgeBleed ? doc.design.margin * (96 / 25.4) : 0);
        // A page-ending bled partial figure may be stretched down to the trim.
        // paginate.ts records how much BODY height is available beside it, so
        // fill those free tracks for the full useful height rather than only
        // for the image's unstretched aspect-ratio height.
        const rowH =
          p.wrapHeight ?? figureHeightPx(probe, figW, captionW, geo.aspect, geo.caption);
        // Every one of the fcols tracks is the same colW (the CSS grid this
        // renders as — .flow-wraprow in page.css — uses fcols equal 1fr
        // tracks), so a free column is just colW regardless of how many
        // there are.
        const freeColW = colW;

        // Prefer plain text immediately AFTER the figure, preserving the old
        // figure-then-copy flow. If that run cannot fill the available tracks,
        // also admit the contiguous text immediately BEFORE the figure. This
        // is what prevents a page-ending/right-edge image from leaving blank
        // columns merely because the author placed it after the paragraph it
        // illustrates. We never cross another figure/equation/aside.
        let end = i + 1;
        while (end < pieces.length && pieces[end].kind === 'text') end++;
        const after = pieces.slice(i + 1, end) as TextPiece[];
        let priorStart = out.length;
        while (priorStart > 0 && out[priorStart - 1].kind === 'text') priorStart--;
        const before = out.slice(priorStart) as TextPiece[];

        // className is set once per page by the caller (wrapAll()) — same
        // `.body-cols p` / `.mag-cols p` / indent selectors columnFill.ts's
        // columnizePage() relies on, so font size, line-height, margins and
        // indents all measure exactly as they render. Only geometry changes
        // here, per figure.
        probe.style.width = `${freeColW}px`;
        probe.style.height = `${Math.max(0, rowH)}px`;
        // `column-count: 1` still creates implicit sideways overflow columns in
        // Chromium. A normal block is the only reliable one-column probe.
        probe.style.setProperty('column-count', 'initial');
        probe.style.setProperty('column-width', 'auto');
        probe.style.overflow = 'hidden';
        // Match the rendered side column's final-paragraph spacing. Ordinary
        // body paragraphs reserve a bottom margin for the next paragraph;
        // the final paragraph beside a figure has no next paragraph inside
        // that row, so keeping that margin would manufacture another visible
        // strip of white space at the caption's foot.
        probe.classList.add('flow-wrap-probe');

        // A figure row is different from a trailing text-only page: its fixed
        // visual boundary is the BOTTOM of the complete figure, including its
        // caption. Do not shrink to a shorter balanced height here. Filling
        // every free track against rowH is what lets body copy continue beside
        // all caption lines instead of leaving a white caption-height band.
        const fullHeightFill = (items: TextPiece[]) => {
          probe.style.height = `${Math.max(0, rowH)}px`;
          return fillColumns(items, probe, readingFree.length, isOverflowing);
        };

        let { columns, remainder } = fullHeightFill(after);
        let usedBefore = false;
        // No remaining `after` text means every available following word was
        // used, but it does not mean the final free track is visually full.
        // Re-run with the adjacent preceding run in front so all useful copy
        // can share the image row. Also recover a completely empty track when
        // an indivisible following token could not start it.
        if (
          before.length > 0 &&
          (remainder.length === 0 || columns.some((column) => column.length === 0))
        ) {
          ({ columns, remainder } = fullHeightFill([...before, ...after]));
          usedBefore = true;
        }
        const sideColumns = readingFree
          .map((column, ci) => ({ column, pieces: columns[ci] ?? [] }))
          .filter((col) => col.pieces.length > 0);

        // `remainder` isn't just "candidates minus however many were used" —
        // fillColumns()/splitAt() may cut the LAST placed paragraph mid-word,
        // so remainder's first piece can be a synthetic tail continuation
        // that never existed in `candidates`. Counting items in vs. items out
        // to compute how far to advance `i` silently drops that tail (or,
        // worse, leaves `i` still pointing at the original whole paragraph,
        // which then gets re-emitted in full — the same text once as the
        // wrap-row's split head and again, complete, right after it).
        // Splicing `remainder` into `pieces` in place of the whole candidates
        // run sidesteps the accounting entirely: whatever fillColumns didn't
        // use keeps flowing exactly where it left off, split or not.
        if (usedBefore) out.splice(priorStart);
        pieces = [...pieces.slice(0, i + 1), ...remainder, ...pieces.slice(end)];
        out.push({
          kind: 'wrap-row',
          figureId: p.id,
          side: geo.pos,
          nFig: geo.n,
          fcols,
          wrapHeight: rowH,
          sideColumns,
        });
        i = i + 1;
        continue;
      }
      // A numeric span that equals/exceeds this particular page's available
      // tracks is visually full width. Carry the actual count to Flow so it
      // gets full-width (both-side) bleed instead of a one-sided partial rule.
      out.push(geo && geo.n >= fcols ? { ...p, fcols } : p);
      i++;
      continue;
    }

    // plain text
    out.push(p);
    i++;
  }

  return out;
}

/** Apply wrapPartialFigures across every page, resolving each page's own
 *  fcols/colW/gutter from its measuring host — same clamp-to-last-host
 *  convention as columnFill.ts's columnizeAll(). Runs BEFORE columnizeAll()'s
 *  own text-only sequential-fill pass, since a page holding a wrap-row is no
 *  longer text-only and would otherwise be skipped by it anyway. */
export function wrapAll(
  pages: Piece[][],
  doc: Doc,
  hosts: (HTMLElement | null | undefined)[],
  probe: HTMLElement | null | undefined,
): Piece[][] {
  if (!hosts.length || !probe) return pages;
  const hostAt = (i: number) => hosts[Math.min(i, hosts.length - 1)];

  /** Formatting markers may be rebalanced when a paragraph is split, so use
   * visible words—not raw marker-bearing strings—when checking how much of a
   * following page was absorbed beside a figure. */
  const visibleWords = (pieces: TextPiece[]) =>
    pieces.flatMap((piece) =>
      parseRuns(piece.text).flatMap((run) =>
        (run.math ? `$${run.text}$` : run.text).trim().split(/\s+/).filter(Boolean),
      ),
    );

  const consumedBorrowedPrefix = (
    row: Extract<Piece, { kind: 'wrap-row' }>,
    borrowed: TextPiece[],
  ) => {
    const beside = visibleWords(row.sideColumns.flatMap((column) => column.pieces));
    const following = visibleWords(borrowed);
    const max = Math.min(beside.length, following.length);
    for (let n = max; n > 0; n--) {
      const suffix = beside.slice(beside.length - n);
      const prefix = following.slice(0, n);
      if (suffix.every((word, index) => word === prefix[index])) return n;
    }
    return 0;
  };

  // Work page-by-page rather than with an isolated map. A partial-width image
  // at the foot of one sheet is allowed to borrow the next sheet's leading
  // text into its free tracks. The unconsumed tail is put back at the front of
  // the donor sheet, so reading order and every word remain intact.
  const work = pages.map((page) => page.slice());
  for (let i = 0; i < work.length; i++) {
    const pcs = work[i];
    const host = hostAt(i);
    if (!host) continue;
    const cs = getComputedStyle(host);
    const gutter = parseFloat(cs.columnGap) || 0;
    const fcols = parseInt(cs.columnCount, 10) || 1;
    const colW = fcols > 1 ? (host.clientWidth - (fcols - 1) * gutter) / fcols : host.clientWidth;
    if (fcols < 2 || !colW) continue;
    probe.className = host.className;
    const rtl = cs.direction === 'rtl';
    const rightEdgeIsFree = !host.classList.contains('body-cols--railed');

    let acceptedBorrow = false;
    const next = work[i + 1];
    if (next?.length) {
      let leadingCount = 0;
      while (leadingCount < next.length && next[leadingCount].kind === 'text') leadingCount++;
      const borrowed = next.slice(0, leadingCount) as TextPiece[];

      // Only the final partial figure whose remaining local run is plain text
      // can safely borrow forward. We never cross another figure, equation or
      // highlights atom, so visual wrapping cannot reorder unrelated content.
      let figureIndex = -1;
      for (let j = pcs.length - 1; j >= 0; j--) {
        if (pcs.slice(j + 1).some((piece) => piece.kind !== 'text')) break;
        const candidate = pcs[j];
        if (candidate.kind !== 'figure') continue;
        const geo = figureGeometry(doc, candidate.id);
        if (geo && geo.n < fcols) {
          figureIndex = j;
          break;
        }
      }

      if (figureIndex >= 0 && borrowed.length) {
        const figure = pcs[figureIndex];
        if (figure.kind === 'figure') {
          const wrapped = wrapPartialFigures(
            [...pcs, ...borrowed],
            doc,
            fcols,
            colW,
            gutter,
            probe,
            overflows,
            rtl,
            rightEdgeIsFree,
          );
          const rowIndex = wrapped.findIndex(
            (piece) => piece.kind === 'wrap-row' && piece.figureId === figure.id,
          );
          const row = rowIndex >= 0 ? wrapped[rowIndex] : null;
          if (
            row?.kind === 'wrap-row' &&
            consumedBorrowedPrefix(row, borrowed) > 0
          ) {
            // Because borrowed text is the suffix of the candidate run and
            // fillColumns consumes sequentially, once any borrowed word is in
            // the row all local post-figure text is already there too. Anything
            // after the row is therefore precisely the unconsumed borrowed tail.
            work[i] = wrapped.slice(0, rowIndex + 1);
            work[i + 1] = [...wrapped.slice(rowIndex + 1), ...next.slice(leadingCount)];
            acceptedBorrow = true;
          }
        }
      }
    }

    if (!acceptedBorrow) {
      work[i] = wrapPartialFigures(
        pcs,
        doc,
        fcols,
        colW,
        gutter,
        probe,
        overflows,
        rtl,
        rightEdgeIsFree,
      );
    }
  }

  return work.filter((page) => page.length > 0);
}
