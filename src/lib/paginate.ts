/**
 * One break point. Not a general pagination engine.
 *
 * The gotcha: in a fixed-height multicolumn box, overflow normally does NOT grow
 * scrollHeight — the browser spills a new column sideways. So we measure width.
 *
 * The exception, and it is the reason this reads both axes: a `column-span: all`
 * element (a full-width or bleeding figure) splits the box into column rows and
 * stacks them. Past the last row the box grows DOWN, not sideways, so scrollWidth
 * stays flush and only scrollHeight moves. Measured, not assumed — with a spanner
 * present, width caught nothing and height caught every case.
 *
 * The flow is a linear list of items: paragraphs (splittable at word
 * boundaries) and figures (atomic blocks). A figure never splits. An ordinary
 * figure moves whole to page 2; an editorially anchored figure may first let
 * its own paragraph continuation use the remaining page space, then advances
 * whole to the next valid position.
 */
import { runsToHtml, openMarkers, renderTex } from './richtext';
import { fitEquation } from './mathfit';
import { fillColumns } from './columnFill';

export const overflows = (el: HTMLElement) =>
  el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Input item. Figures carry the geometry needed to measure their block.
 *  `widthBasis`: 1 = sits inside one flowing column (not a spanner); 2 | 3 | 4 =
 *  a spanning row sized to that many columns' width; 'body' = full body width.
 *  `pos` picks which side of the row a partial spanner sits on (ignored for 1
 *  and 'body'). `bleed` = carried past the margin to the sheet edge on
 *  whichever side is already flush there (full width → both sides; a partial
 *  spanner → whichever side `pos` put there; ignored for 1) — CSS alone knows
 *  exactly how much wider that makes it, so paint() measures the real class'd
 *  element rather than doing the arithmetic here. Text carries `indent` so the
 *  measuring twin's first-line width matches the real render (a wrong wrap
 *  point is its own overflow bug). */
export type FlowItem =
  | {
      kind: 'text';
      /** Stable source paragraph id, retained across every pagination split. */
      sourceId?: string;
      text: string;
      indent?: boolean;
      cont?: boolean;
      fontSize?: number;
      color?: string;
    }
  | {
      kind: 'figure';
      id: string;
      aspect: number;
      hasCaption: boolean;
      /** Rich-text caption measured at its actual rendered width. */
      caption?: string;
      widthBasis: 1 | 2 | 3 | 4 | 'body';
      pos?: 'left' | 'center' | 'right';
      bleed?: boolean;
      /** Height available to text beside a page-ending partial figure. The
       *  paginator computes this from the figure's real vertical position so
       *  textWrap.ts can fill every unused track down to the body edge. */
      wrapHeight?: number;
      /**
       * Span-1 float wrap (see the same field on the figure Block) — only
       * meaningful when widthBasis is 1; a spanner always ignores it, the
       * same as the real render does. Absent/'none' = today's plain block,
       * measured exactly as before.
       */
      wrap?: 'none' | 'box' | 'tight';
      /** Anchored inside a paragraph. If the figure cannot fit at the page
       * foot, its own continuation may fill the remaining columns while the
       * figure advances to the next valid position, like an editorial float. */
      floatAnchor?: boolean;
    }
  | { kind: 'equation'; id: string; tex: string; caption: string };

/** Working item during the search — a text run may be flagged as a continuation. */
type PaintItem =
  | {
      kind: 'text';
      sourceId?: string;
      text: string;
      cont?: boolean;
      indent?: boolean;
      fontSize?: number;
      color?: string;
    }
  | {
      kind: 'figure';
      id: string;
      aspect: number;
      hasCaption: boolean;
      caption?: string;
      widthBasis: 1 | 2 | 3 | 4 | 'body';
      pos?: 'left' | 'center' | 'right';
      bleed?: boolean;
      wrapHeight?: number;
      wrap?: 'none' | 'box' | 'tight';
      floatAnchor?: boolean;
    }
  | { kind: 'equation'; id: string; tex: string; caption: string };

/** Output piece. Pages are rendered from these; figures/equations resolve by id.
 *  `colBreak`: set by lib/columnFill.ts's post-pass on a sequentially-filled
 *  page — this
 *  piece opens a new flowing column. Chromium's real `column-fill: auto` silently
 *  behaves like `balance` whenever a box's content fits without overflowing it
 *  (true of every document's last page, by construction of fillOne()'s search),
 *  so it can't be trusted to fill columns to capacity before spilling — the
 *  break is computed and stamped explicitly instead. A one-column figure can
 *  carry the same marker because it participates in the normal reading flow;
 *  spanning figures/equations still split the page into separate rows. */
/** Real text-wrap beside a partial-width figure — stamped by
 *  lib/textWrap.ts's post-pass, replacing a lone `{kind:'figure'}` piece with
 *  a full-row grid whose unused physical tracks carry following copy. */
export type Piece =
  | {
      kind: 'text';
      sourceId?: string;
      text: string;
      cont?: boolean;
      indent?: boolean;
      colBreak?: boolean;
      fontSize?: number;
      color?: string;
      /** Rectangular vertical bands occupied by independently positioned page
       * images in this physical column, measured in unscaled CSS pixels from
       * the top of the flow box. Present only on a column's first piece. */
      exclusions?: { top: number; bottom: number }[];
    }
  | { kind: 'figure'; id: string; wrapHeight?: number; fcols?: number; colBreak?: boolean }
  | { kind: 'equation'; id: string }
  | {
      /** A page containing independently positioned images. Text is already
       * measured into explicit writable regions above/below those images, so
       * rendering never depends on Chromium's fragile CSS Shape fragmentation. */
      kind: 'image-columns';
      height: number;
      columns: {
        segments: {
          /** Reading order across logical columns and their vertical segments. */
          order: number;
          top: number;
          bottom: number;
          pieces: {
            kind: 'text';
            sourceId?: string;
            text: string;
            cont?: boolean;
            indent?: boolean;
            fontSize?: number;
            color?: string;
          }[];
        }[];
      }[];
    }
  | {
      kind: 'wrap-row';
      figureId: string;
      side: 'left' | 'center' | 'right';
      nFig: number;
      fcols: number;
      /** Height used to fill each free track beside the figure. */
      wrapHeight?: number;
      /** Text already measured into the physical grid columns not occupied by
       *  the figure. Separate column boxes avoid Chromium's unreliable nested
       *  multicolumn balancing and also make a centred figure possible. */
      sideColumns: {
        column: number;
        pieces: Extract<Piece, { kind: 'text' }>[];
      }[];
    };

export interface Pagination {
  /** pages[0] = page-1 geometry (hero + header). pages[1..] = continuation pages,
   *  all sharing the same taller box. As many pages as the text needs. */
  pages: Piece[][];
  /** 0..1 — how full the LAST page is. Drives the fit nudge. */
  fill: number;
  /** words living beyond page 1 (for the fit message) */
  spill: number;
}

const toPieces = (items: PaintItem[]): Piece[] =>
  items.map((it) =>
    it.kind === 'figure'
      ? { kind: 'figure', id: it.id, wrapHeight: it.wrapHeight }
      : it.kind === 'equation'
        ? { kind: 'equation', id: it.id }
        : {
            kind: 'text',
            ...(it.sourceId ? { sourceId: it.sourceId } : {}),
            text: it.text,
            cont: it.cont,
            indent: it.indent,
            fontSize: it.fontSize,
            color: it.color,
          },
  );

/** How wide would an element with this class (and, for a partial spanner, this
 *  --n) render inside `host`? A throwaway probe, appended/measured/removed —
 *  never left in the box, so it can never itself register as overflow. */
function probeWidth(host: HTMLElement, cls: string, n?: number): number {
  const probe = document.createElement('div');
  probe.className = cls;
  if (n !== undefined) probe.style.setProperty('--n', String(n));
  probe.style.height = '0';
  host.appendChild(probe);
  const w = probe.offsetWidth;
  probe.remove();
  return w;
}

/**
 * Render items into a measuring host. A figure becomes a full-width placeholder
 * whose height is derived from the host's current column-body width and the
 * image aspect ratio, so it displaces the same space as the real <figure>.
 */
function paint(el: HTMLElement, items: PaintItem[]) {
  el.innerHTML = '';
  const cs = getComputedStyle(el);
  const gap = parseFloat(cs.columnGap) || 0;
  const count = parseInt(cs.columnCount) || 1;
  const colW = count > 1 ? (el.clientWidth - (count - 1) * gap) / count : el.clientWidth;
  for (const [itemIndex, it] of items.entries()) {
    if (it.kind === 'equation') {
      // A display equation is an atomic full-width spanner. Render the real KaTeX
      // (and shrink a too-wide formula, exactly as the visible page does) so the
      // measured height matches what paints on the sheet.
      const fig = document.createElement('figure');
      fig.className = 'flow-eq';
      const tex = document.createElement('span');
      tex.className = 'flow-eq-tex';
      tex.innerHTML = renderTex(it.tex, true);
      fig.appendChild(tex);
      if (it.caption.trim()) {
        const cap = document.createElement('figcaption');
        cap.innerHTML = runsToHtml(it.caption);
        fig.appendChild(cap);
      }
      el.appendChild(fig);
      fitEquation(tex);
      continue;
    }
    if (it.kind === 'figure') {
      const d = document.createElement('figure');
      // A spanner (widthBasis !== 1) breaks every column, like the real
      // `column-span: all` figure; widthBasis 1 displaces only a single
      // flowing column's worth of height. `d` itself is always classed
      // WITHOUT `flow-fig--bleed`, even when the figure bleeds: its negative
      // margins would hang past `el`'s own edge and register as sideways
      // spill on every single measurement, so the box would look permanently
      // overflowing. A bled width is measured on a throwaway probe instead —
      // same trick the old single-shape bleed used, now per class combo since
      // a bled width now depends on span+pos, not just "bleeding or not".
      const isSpanner = it.widthBasis !== 1;
      let w: number;
      if (!isSpanner) {
        const wrap = it.wrap && it.wrap !== 'none' ? it.wrap : null;
        if (wrap) {
          // Floated span-1 figure: this measuring host already carries the
          // real body/column CSS, so a same-class floated placeholder makes
          // the following <p> elements really reflow around it — no need to
          // simulate that part by hand, only the placeholder's own height
          // (still a formula, same as every other figure here) needs one.
          // Never given `shape-outside` even for 'tight': a plain rectangle
          // narrows the wrapped text at least as much as (never less than)
          // the real alpha-shaped wrap would, so this can only over-reserve
          // height, never under-reserve it.
          const side = it.pos === 'right' ? 'right' : 'left';
          d.className = `flow-fig flow-fig--col flow-fig--wrap flow-fig--wrap-${side}`;
          el.appendChild(d);
          w = d.offsetWidth;
        } else {
          d.className = 'flow-fig flow-fig--col';
          el.appendChild(d);
          w = colW;
        }
      } else if (
        it.widthBasis === 'body' ||
        (typeof it.widthBasis === 'number' && it.widthBasis >= count)
      ) {
        d.className = 'flow-fig flow-fig--full';
        el.appendChild(d);
        w = it.bleed ? probeWidth(el, 'flow-fig flow-fig--full flow-fig--bleed') : d.offsetWidth;
      } else {
        const pos = it.pos ?? 'center';
        d.className = `flow-fig flow-fig--n flow-fig--pos-${pos}`;
        d.style.setProperty('--n', String(it.widthBasis));
        el.appendChild(d);
        const bleedOn = it.bleed && pos !== 'center';
        w = bleedOn
          ? probeWidth(el, `flow-fig flow-fig--n flow-fig--pos-${pos} flow-fig--bleed`, it.widthBasis)
          : d.offsetWidth;
      }
      // Measure the caption as real styled text. The old fixed 6%-of-width
      // allowance was only accurate for a single short line; a long or large
      // caption could take two/three lines and the following body copy would
      // then collide with it because the paginator had reserved too little.
      const media = document.createElement('div');
      media.className = 'flow-fig-measure-media';
      media.style.height = `${w * it.aspect}px`;
      d.appendChild(media);
      if (it.caption?.trim()) {
        const cap = document.createElement('figcaption');
        cap.innerHTML = runsToHtml(it.caption);
        d.appendChild(cap);
      } else if (it.hasCaption) {
        // Compatibility for synthetic/test items created before captions were
        // carried in FlowItem. Real document figures always use the branch above.
        d.style.minHeight = `${w * it.aspect + Math.max(16, w * 0.06)}px`;
      }
    } else {
      const p = document.createElement('p');
      // Tri-state: undefined indent leaves the family-default CSS rule alone,
      // so only an explicit true/false ever adds a class. A continuation never
      // gets an indent class at all — `.cont` is the only word on its look.
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
      // innerHTML (not textContent) so **bold**/*italic*/__underline__ render as
      // real inline styling — bold is wider, so the break must measure it.
      p.innerHTML = runsToHtml(it.text, itemIndex === 0);
      if (it.fontSize !== undefined) p.style.fontSize = `${it.fontSize}pt`;
      if (it.color) p.style.color = it.color;
      el.appendChild(p);
    }
  }
}

/**
 * Fill one page box `host` with as many items as fit, splitting the straddling
 * paragraph at a word boundary (figures stay atomic). Returns what landed on the
 * page and what spills past it. Figures remain atomic; a caret anchor only
 * permits the owning paragraph's continuation to pass a figure that cannot fit
 * at the page foot. This is the single break point — `paginate` just calls it
 * once per page.
 */
function fillOne(
  host: HTMLElement,
  src: PaintItem[],
  isOverflowing: (el: HTMLElement) => boolean,
): { placed: PaintItem[]; rest: PaintItem[] } {
  /**
   * A requested edge bleed is only safe when the figure is at a page boundary.
   * If it sits between copy above and below, extending it to an edge would
   * otherwise paint over that copy. A full-width spanner therefore finishes
   * the page. A PARTIAL spanner also finishes the page, but first keeps as much
   * following text as fits in its unused physical tracks. Its measured
   * `wrapHeight` runs from the figure's actual top to the body bottom; the
   * later textWrap pass uses that same height, so the image can reach the trim
   * without leaving the remaining columns blank. Span-1 figures are excluded:
   * they never own a full column row or a page edge.
   */
  const keepBleedAtPageEdge = (
    placed: PaintItem[],
    rest: PaintItem[],
  ): { placed: PaintItem[]; rest: PaintItem[] } => {
    const interior = placed.findIndex(
      (it, i) =>
        i > 0 &&
        i < placed.length - 1 &&
        it.kind === 'figure' &&
        it.bleed === true &&
        it.widthBasis !== 1,
    );
    if (interior < 0) return { placed, rest };

    const figure = placed[interior];
    if (figure.kind !== 'figure') return { placed, rest };
    const cs = getComputedStyle(host);
    const fcols = parseInt(cs.columnCount, 10) || 1;
    const nFig = typeof figure.widthBasis === 'number' ? figure.widthBasis : fcols;

    // A partial figure has real text-bearing tracks beside it. Preserve and
    // refill those tracks before sending the true remainder to the next page.
    if (nFig < fcols) {
      paint(host, placed.slice(0, interior + 1));
      const hostRect = host.getBoundingClientRect();
      const figureRect = host.lastElementChild?.getBoundingClientRect();
      const wrapHeight = figureRect ? Math.max(0, hostRect.bottom - figureRect.top) : 0;
      const gutter = parseFloat(cs.columnGap) || 0;
      const colW = (host.clientWidth - (fcols - 1) * gutter) / fcols;

      if (wrapHeight > 0 && colW > 0) {
        const combined = [...placed.slice(interior + 1), ...rest];
        let textEnd = 0;
        while (textEnd < combined.length && combined[textEnd].kind === 'text') textEnd++;
        const candidates = combined.slice(0, textEnd) as Extract<PaintItem, { kind: 'text' }>[];
        const probe = document.createElement('div');
        probe.className = host.className;
        probe.style.position = 'fixed';
        probe.style.left = '-99999px';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.width = `${colW}px`;
        probe.style.height = `${wrapHeight}px`;
        probe.style.setProperty('column-count', 'initial');
        probe.style.setProperty('column-width', 'auto');
        probe.style.overflow = 'hidden';
        (host.parentElement ?? document.body).appendChild(probe);
        const { columns, remainder } = fillColumns(candidates, probe, fcols - nFig, isOverflowing);
        probe.remove();

        return {
          placed: [
            ...placed.slice(0, interior),
            { ...figure, wrapHeight },
            ...columns.flat(),
          ],
          rest: [...remainder, ...combined.slice(textEnd)],
        };
      }
    }

    return {
      placed: placed.slice(0, interior + 1),
      rest: [...placed.slice(interior + 1), ...rest],
    };
  };

  paint(host, src);
  if (!isOverflowing(host)) return keepBleedAtPageEdge(src, []);

  let n = src.length;
  while (n > 0) {
    n--;
    paint(host, src.slice(0, n));
    if (!isOverflowing(host)) break;
  }

  const straddle = src[n];

  if (straddle.kind === 'figure' && straddle.floatAnchor) {
    const continuation = src[n + 1];
    if (continuation?.kind === 'text' && continuation.cont) {
      // A real editorial float remains anchored between the paragraph's head
      // and tail, but it is not a blocking inline atom. When it cannot fit at
      // the page foot, let as much of that SAME paragraph's continuation as
      // possible use the otherwise blank columns, then start the next page
      // with the deferred figure. Never cross into a different paragraph.
      // Once an editorial float advances, normal reading copy may continue
      // past its anchor until the next non-text atom. Restricting this to only
      // the split paragraph tail can still leave a whole final column empty;
      // stretching typography to hide that hole is precisely what we must not
      // do. Keep figures/equations ordered by stopping at the next atom.
      let textEnd = n + 1;
      while (textEnd < src.length && src[textEnd].kind === 'text') textEnd++;
      const flowingText = src.slice(n + 1, textEnd);
      const floated = fillOne(host, [...src.slice(0, n), ...flowingText], isOverflowing);
      if (floated.placed.length > n) {
        return keepBleedAtPageEdge(
          floated.placed,
          // The anchor may defer the figure once, to the next valid page
          // position. Clear the flag there so continuation copy cannot keep
          // leapfrogging it across later pages.
          [{ ...straddle, floatAnchor: false }, ...floated.rest, ...src.slice(textEnd)],
        );
      }
    }
  }

  if (straddle.kind === 'figure' || straddle.kind === 'equation') {
    // Atomic: a figure/equation can't split, so it starts the next page.
    return keepBleedAtPageEdge(src.slice(0, n), src.slice(n));
  }

  // Binary-search the word boundary: ~10 iterations, all inside one JS task,
  // so no intermediate paint survives and no flicker.
  const w = words(straddle.text);
  let lo = 0,
    hi = w.length,
    best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    paint(host, [
      ...src.slice(0, n),
      {
        ...straddle,
        text: w.slice(0, mid).join(' '),
        cont: straddle.cont,
        indent: straddle.cont ? undefined : straddle.indent,
      },
    ]);
    if (!isOverflowing(host)) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  // Final sanity paint: confirm `best` genuinely fits in the REAL box before
  // trusting it — the binary search assumes overflow is monotonic in `mid`
  // (fits at k ⇒ fits at every k' < k), which can be false in a multi-column
  // box (a word landing near a column boundary can shift how later text
  // reflows in ways that aren't strictly monotonic). If the assumption broke,
  // `best` may not actually fit even though the search believed it did.
  paint(host, [
    ...src.slice(0, n),
    {
      ...straddle,
      text: w.slice(0, best).join(' '),
      cont: straddle.cont,
      indent: straddle.cont ? undefined : straddle.indent,
    },
  ]);
  if (isOverflowing(host)) {
    // The search's own final answer overflows the real box. Fall back to a
    // guaranteed-safe linear walk downward from `best` until it genuinely fits
    // (or hits 0, meaning even an empty straddle doesn't fit and the whole
    // paragraph must move to the next page).
    while (best > 0) {
      best--;
      paint(host, [
        ...src.slice(0, n),
        {
          ...straddle,
          text: w.slice(0, best).join(' '),
          cont: straddle.cont,
          indent: straddle.cont ? undefined : straddle.indent,
        },
      ]);
      if (!isOverflowing(host)) break;
    }
  }
  let head = w.slice(0, best).join(' ');
  let tail = w.slice(best).join(' ');
  // Formatting markers open before the break must be closed on the head and
  // reopened on the tail, or the bold/italic/underline would drop after the
  // break. Plain text has no open markers, so this is a no-op there.
  if (head && tail) {
    const open = openMarkers(head);
    head += [...open].reverse().join(''); // close inner marker first
    tail = open.join('') + tail; // reopen in the same nesting order
  }
  // The head is always the paragraph's own start, so it carries the original
  // indent setting. The tail only carries it when this ISN'T a genuine
  // continuation (head empty ⇒ the whole paragraph moved to page 2 unsplit,
  // same indent it always had) — a true continuation (head non-empty) relies
  // solely on the `cont` class, never an indent class.
  const headIsCont = straddle.cont === true;
  const tailIsCont = straddle.cont === true || Boolean(head);
  return keepBleedAtPageEdge(
    [
      ...src.slice(0, n),
      ...(head
        ? [
            {
              ...straddle,
              kind: 'text' as const,
              text: head,
              cont: headIsCont || undefined,
              indent: headIsCont ? undefined : straddle.indent,
            },
          ]
        : []),
    ],
    [
      ...(tail
        ? [
            {
              ...straddle,
              kind: 'text' as const,
              text: tail,
              cont: tailIsCont,
              indent: tailIsCont ? undefined : straddle.indent,
            },
          ]
        : []),
      ...src.slice(n + 1),
    ],
  );
}

/**
 * Break the flow across a sequence of measuring boxes: `hosts[i]` measures
 * region `i`, and the last host repeats for everything past it. A "region" is
 * usually a page, but need not be — paper-2's sheet 1 has two of them (the
 * columns beside the header, then the column under the hero), because a
 * multicolumn box cannot start its columns at different heights.
 *
 * Never measure the visible DOM — React will fight you.
 */
export function paginateHosts(
  hosts: HTMLElement[],
  items: FlowItem[],
  isOverflowing: (el: HTMLElement) => boolean = overflows,
): Pagination {
  const src: PaintItem[] = items.filter((it) => it.kind !== 'text' || it.text.trim() !== '');
  if (!src.length) return { pages: [], fill: 0, spill: 0 };

  const hostAt = (i: number) => hosts[Math.min(i, hosts.length - 1)];

  const pages: PaintItem[][] = [];
  let rest = src;

  while (rest.length) {
    let { placed, rest: next } = fillOne(hostAt(pages.length), rest, isOverflowing);
    // Progress guard: a single item taller than a whole page fits nowhere.
    // Force it onto its own page (clipped by overflow:hidden) rather than loop.
    if (placed.length === 0) {
      placed = [rest[0]];
      next = rest.slice(1);
    }
    pages.push(placed);
    rest = next;
  }

  // Re-measure the last page to report how full it is + its word count.
  const last = pages[pages.length - 1];
  const lastHost = hostAt(pages.length - 1);
  paint(lastHost, last);
  lastHost.insertAdjacentHTML(
    'beforeend',
    '<span data-sentinel style="display:inline-block;width:1px;height:1px"></span>',
  );

  const spill = pages
    .slice(1)
    .flat()
    .reduce((a, it) => a + (it.kind === 'text' ? words(it.text).length : 0), 0);

  return {
    pages: pages.map(toPieces),
    fill: fillOf(lastHost),
    spill,
  };
}

/**
 * `host1` is the hidden measuring node for page 1 (hero + header eat its top).
 * `host2` is the taller continuation box — reused to measure every page ≥ 2,
 * since they share geometry.
 */
export function paginate(
  host1: HTMLElement,
  host2: HTMLElement,
  items: FlowItem[],
  isOverflowing: (el: HTMLElement) => boolean = overflows,
): Pagination {
  return paginateHosts([host1, host2], items, isOverflowing);
}

/** Where did the last atom of text land? Column index + drop tells us fullness. */
export function fillOf(el: HTMLElement): number {
  const s = el.querySelector('[data-sentinel]');
  if (!s) return 0;
  const c = el.getBoundingClientRect();
  const r = s.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  const count = parseInt(getComputedStyle(el).columnCount) || 1;
  const colW = (el.clientWidth - (count - 1) * gap) / count;
  const col = Math.round((r.left - c.left) / (colW + gap));
  if (!el.clientHeight) return 0;
  return Math.min(1, (col + (r.bottom - c.top) / el.clientHeight) / count);
}

export type FitLevel = 'ok' | 'warn' | 'bad';

/** How many pages, and how full the last one is. */
export function fitMessage(p: Pagination): { level: FitLevel; text: string } {
  const n = p.pages.length;
  if (n <= 1) return { level: 'ok', text: '1 page' };
  const pct = Math.round(p.fill * 100);
  // A barely-used last page is worth a gentle nudge, not an error — long is fine.
  if (p.spill && p.fill < 0.25)
    return {
      level: 'warn',
      text: `${n} pages · last page nearly empty. Cut ~${p.spill} words to save a page.`,
    };
  return { level: 'ok', text: `${n} pages · last page ${pct}% full` };
}
