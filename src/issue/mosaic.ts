/**
 * Filling a contents page with cards.
 *
 * Two columns. Cards drop into them from the top, each one as tall as its own
 * content needs to be — a card with a picture and a standfirst is tall, a bare
 * one-line brief is short — and a column takes cards until the next one would
 * not fit, at which point the next column starts. Reading order is never
 * disturbed: down the first column, down the second, then over the leaf.
 *
 * This is deliberately not a grid of equal boxes and not a tiling puzzle. The
 * card's height is decided by what is in it, which is what makes the page look
 * edited rather than generated. What this module owns is only the arithmetic:
 * given the measured height of every card, which column each one lands in, and
 * how much air to put between them so a column reaches the foot of the page
 * instead of stopping short.
 *
 * Nothing here can overflow, because a card is only placed in a column that
 * has already been shown to have room for it. Anything left over at the end of
 * the last column is reported rather than drawn, so the studio can say so.
 */

export interface PackedPlan {
  /** Entry indices, by page, then by column. */
  pages: number[][][];
  /** How many entries were placed. Fewer than supplied means the rest do not
   * fit and the editor has to be told. */
  placed: number;
}

export interface PackOptions {
  columnHeight: number;
  /** The smallest air between two cards in a column. */
  gap: number;
  columnsPerPage?: number;
  pages?: number;
}

/** Height of a run of cards in one column, gaps included. */
const runHeight = (heights: readonly number[], from: number, to: number, gap: number) => {
  let total = 0;
  for (let i = from; i < to; i++) total += Math.max(0, heights[i]);
  return total + gap * Math.max(0, to - from - 1);
};

/**
 * Split a run of cards into exactly `parts` contiguous columns, making the
 * tallest column as short as possible.
 *
 * Filling greedily from the top packs the first column to the brim and leaves
 * the last one holding whatever is left — which is how a contents page ends up
 * with six entries in one column and one in the next. Balancing instead means
 * every column ends near the foot of the page, and since the leftover slack is
 * then spread between that column's own cards, all of them finish flush.
 * Reading order is preserved: the parts are contiguous, so the sequence still
 * runs down the first column and on into the second.
 */
function balance(heights: readonly number[], gap: number, parts: number): number[][] {
  const count = heights.length;
  if (parts <= 1 || count <= parts) {
    return parts <= 1
      ? [Array.from({ length: count }, (_, i) => i)]
      : Array.from({ length: parts }, (_, p) => (p < count ? [p] : []));
  }
  // best[p][i] — the smallest possible tallest column when the first i cards
  // are laid into p columns. cut[p][i] remembers where that split fell.
  const best: number[][] = Array.from({ length: parts + 1 }, () => new Array(count + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: parts + 1 }, () => new Array(count + 1).fill(0));
  best[0][0] = 0;
  for (let p = 1; p <= parts; p++) {
    for (let i = p; i <= count; i++) {
      for (let j = p - 1; j < i; j++) {
        if (best[p - 1][j] === Infinity) continue;
        const tallest = Math.max(best[p - 1][j], runHeight(heights, j, i, gap));
        if (tallest < best[p][i]) { best[p][i] = tallest; cut[p][i] = j; }
      }
    }
  }
  const out: number[][] = [];
  let end = count;
  for (let p = parts; p >= 1; p--) {
    const start = cut[p][end];
    out.unshift(Array.from({ length: end - start }, (_, k) => start + k));
    end = start;
  }
  return out;
}

/**
 * Deal the cards into the sheet's columns.
 *
 * Cards fill from the top in reading order, a column taking cards until the
 * next one would not fit — that is what makes the spread read down the first
 * column and on into the second, and it is why the earlier columns come out
 * brim-full rather than artificially evened out.
 *
 * The one place that is wrong is the end of the run. Filling greedily leaves
 * the tail wherever it happens to land, which is how a second sheet ends up
 * with one packed column beside an empty one. So the last sheet in use — and
 * only that one — has its cards spread across its own two columns, so the
 * spread finishes on a balanced page instead of a lopsided one.
 *
 * Anything that will not fit at all is reported rather than drawn.
 */
export function packColumns(heights: readonly number[], { columnHeight, gap, columnsPerPage = 2, pages = 2 }: PackOptions): PackedPlan {
  const total = pages * columnsPerPage;
  const empty = (): number[][][] => Array.from({ length: pages }, () => Array.from({ length: columnsPerPage }, () => [] as number[]));
  if (columnHeight <= 0 || heights.length === 0) return { pages: empty(), placed: 0 };

  // Greedy, column by column.
  const columns: number[][] = Array.from({ length: total }, () => [] as number[]);
  let column = 0;
  let used = 0;
  let placed = 0;
  for (let index = 0; index < heights.length; index++) {
    const height = Math.max(0, heights[index]);
    const needed = used + (used > 0 ? gap : 0) + height;
    if (needed <= columnHeight || used === 0) { columns[column].push(index); used = needed; placed++; continue; }
    column++;
    if (column >= total) break;
    columns[column].push(index);
    used = height;
    placed++;
  }

  // A contents spread is two sheets whether or not the second is needed, so a
  // short issue that all fits on the first one would print a blank page. When
  // that happens the whole run is shared across both sheets instead — sparser
  // columns read as a spread, an empty sheet reads as a mistake.
  const lastUsed = columns.reduce((last, group, index) => (group.length ? index : last), 0);
  if (placed > 1 && Math.floor(lastUsed / columnsPerPage) < pages - 1) {
    const all = columns.flat();
    const spread = balance(all.map(index => heights[index]), gap, total).map(group => group.map(offset => all[offset]));
    if (spread.every(group => runHeight(heights, group[0] ?? 0, (group[group.length - 1] ?? -1) + 1, gap) <= columnHeight)) {
      spread.forEach((group, index) => { columns[index] = group; });
    }
  }

  // Even out the final sheet.
  const lastColumn = columns.reduce((last, group, index) => (group.length ? index : last), 0);
  const lastPage = Math.floor(lastColumn / columnsPerPage);
  const tail = columns.slice(lastPage * columnsPerPage, (lastPage + 1) * columnsPerPage).flat();
  if (tail.length > 1) {
    const spread = balance(tail.map(index => heights[index]), gap, columnsPerPage)
      .map(group => group.map(offset => tail[offset]));
    const fits = spread.every(group => runHeight(heights, group[0] ?? 0, (group[group.length - 1] ?? -1) + 1, gap) <= columnHeight);
    if (fits) spread.forEach((group, offset) => { columns[lastPage * columnsPerPage + offset] = group; });
  }

  const plan = empty();
  columns.forEach((group, index) => {
    const page = Math.floor(index / columnsPerPage);
    if (page < pages) plan[page][index % columnsPerPage] = group;
  });
  return { pages: plan, placed };
}

/**
 * The air to put between the cards of one column.
 *
 * A column packed from the top leaves its slack at the foot, which reads as
 * the page having run out rather than having been laid out. Spreading that
 * slack between the cards instead lets the column reach the bottom margin, the
 * way a designer would space a short column by hand. Only up to a point: past
 * roughly a card's worth of air the cards stop reading as a list and start
 * reading as unrelated fragments, so beyond `maxExtra` the remainder is left
 * at the foot where it belongs.
 */
export function columnGap(heights: readonly number[], columnHeight: number, gap: number, maxExtra: number): number {
  if (heights.length <= 1) return gap;
  const content = heights.reduce((sum, height) => sum + Math.max(0, height), 0);
  const slack = columnHeight - content - gap * (heights.length - 1);
  if (slack <= 0) return gap;
  return gap + Math.min(maxExtra, slack / (heights.length - 1));
}

/** Small, fast, seeded PRNG (mulberry32). Deterministic across machines. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed for a set of entries, so the same issue lays out the same way. */
export function mosaicSeed(keys: readonly string[], salt = 0): number {
  let hash = 0x811c9dc5;
  for (const key of [...keys, String(salt)]) {
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x2d;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * How tall each picture is, as a multiple of the column width.
 *
 * The photograph's own shape leads — a portrait stays upright, a landscape
 * stays wide — but it is nudged by a seeded amount and clamped, so a column of
 * cards has a varied rhythm instead of every picture being the same band, and
 * so no single picture can eat a whole column. Deterministic: the same issue
 * gets the same rhythm until the editor shuffles it.
 */
export function pictureRatios(
  aspects: readonly (number | undefined)[],
  seed: number,
  { min = 0.5, max = 1.18 }: { min?: number; max?: number } = {},
): number[] {
  const next = random(seed);
  return aspects.map(aspect => {
    const roll = next();
    if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return min + (max - min) * 0.45;
    // aspect is width/height; the picture's natural height per unit width is
    // its reciprocal.
    const natural = 1 / aspect;
    const nudged = natural * (0.88 + roll * 0.24);
    return Math.min(max, Math.max(min, nudged));
  });
}

export interface PictureChoice {
  /** Card heights with the picture left off. */
  text: readonly number[];
  /** Card heights with the picture in. Equal to `text` where an entry has none. */
  picture: readonly number[];
  /** Which entries have a picture available at all. */
  eligible: readonly boolean[];
  /** true — the editor insists on a picture here; false — insists on none;
   * undefined — the spread decides. */
  forced: readonly (boolean | undefined)[];
  /** Entry indices, best candidates for a picture first. */
  order: readonly number[];
  pack: PackOptions;
}

/**
 * Decide which contents cards carry a picture.
 *
 * Not a threshold and not a guess. The spread is first laid out as pure text,
 * which is the most that could ever fit; then pictures are handed back one at
 * a time, best candidate first, and each one is kept only if the whole
 * contents still packs onto its sheets afterwards. The answer is therefore the
 * most pictures this particular issue can carry — a page fills itself instead
 * of being tuned, and it cannot overflow, because every state it passes
 * through has been checked against the real packer rather than an estimate.
 *
 * Where even the text-only spread will not fit, the editor's insisted-upon
 * pictures are given up too, so the density step that follows starts from the
 * smallest the contents can be rather than failing with pictures still in.
 */
export function choosePictures({ text, picture, eligible, forced, order, pack }: PictureChoice): boolean[] {
  const count = text.length;
  const chosen = Array.from({ length: count }, (_, i) => eligible[i] && forced[i] === true);
  const heights = (state: readonly boolean[]) => state.map((on, i) => (on ? picture[i] : text[i]));
  const fits = (state: readonly boolean[]) => packColumns(heights(state), pack).placed === count;

  // Where the editor has asked for more pictures than the sheets can hold,
  // give them up worst-candidate first until the contents fits at all.
  if (!fits(chosen)) {
    for (let k = order.length - 1; k >= 0 && !fits(chosen); k--) {
      if (chosen[order[k]]) chosen[order[k]] = false;
    }
  }
  // Then hand pictures back, best candidate first, keeping each only while
  // the whole contents still packs. This is what makes 'every entry that has
  // one' degrade to 'as many as will fit' rather than to an arbitrary subset,
  // and it is the same loop that fills an automatic page.
  for (const index of order) {
    if (!eligible[index] || chosen[index] || forced[index] === false) continue;
    chosen[index] = true;
    if (!fits(chosen)) chosen[index] = false;
  }
  return chosen;
}
