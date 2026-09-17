import type { Asset, Doc } from '../schema/document';
import { parseRuns } from '../lib/richtext';
import { normalizeImageFrame, type ImageFrame } from '../lib/imageFrame';

export const CONTENTS_ID = '__contents__';
export interface IssuePlan {
  order: string[]; startNumber: number; countCovers: boolean;
  contentsTitle: string; contentsSubtitle: string; direction: 'ltr' | 'rtl'; contentsExcluded: string[];
  /** Optional so plans saved before the contents designer existed still load. */
  contentsDesign?: Partial<ContentsDesign>;
  contentsStyle?: Record<string, ContentsEntryStyle>;
}

/** What the editor may override per line of the contents, independently of the
 * article itself: the contents is its own page, not a mirror of the documents. */
export interface ContentsEntryStyle {
  title?: string;
  deck?: string;
  /** A chip beside the title — 'COVER STORY', 'IN DEPTH', whatever the issue uses. */
  badge?: string;
  /** Groups consecutive entries under one heading, the way a section-led
   * contents page reads. Empty string or absent = no heading above this entry. */
  section?: string;
  /** Which picture this line shows. null pins it to no picture at all; absent
   * falls back to the article's own hero. */
  assetId?: string | null;
  /** Show a picture on this line at all. Absent follows the spread-wide
   * "Show hero images" switch; false drops the picture for this one entry
   * even when the spread shows pictures, true keeps it when the spread
   * does not. A contents page is not obliged to illustrate every line —
   * a portrait that crops badly, or a story with no usable photo, reads
   * better as a text line beside the ones that do carry a picture. */
  hero?: boolean;
  /** Zoom and pan inside the fixed contents frame — the same frame model the
   * article templates use, so a crop set here behaves like a crop set there. */
  frame?: ImageFrame;
  /** The 'p.12' chip over the picture. */
  pageLabel?: boolean;
}

export type ContentsLayout = 'feature' | 'sections';
export type ContentsDensity = 'auto' | 'airy' | 'normal' | 'dense' | 'packed';

export interface ContentsDesign {
  layout: ContentsLayout;
  density: ContentsDensity;
  accent: string;
  /** Second accent, for the section headings in the sections layout. */
  headingColor: string;
  columns: 1 | 2;
  showHeroes: boolean;
  pageLabels: boolean;
  /** Printed millimetres. The lead picture and the per-entry thumbnails. */
  featureHeight: number;
  thumbHeight: number;
  rules: boolean;
  paddedNumbers: boolean;
  /** Headline typeface: the same two families the rest of the issue offers. */
  titleFont: 'serif' | 'sans';
  /** Multiplies every contents type size at once, from 85% to 115%. */
  textScale: number;
  /** Added to each headline's own letter-spacing, in em. */
  tracking: number;
  /** Multiplies every gap between entries, sections and rails at once. */
  gapScale: number;
}

export const DEFAULT_CONTENTS_DESIGN: ContentsDesign = {
  layout: 'sections', density: 'auto', accent: '#9a603c', headingColor: '#1f6f8b', columns: 2,
  showHeroes: true, pageLabels: false, featureHeight: 59, thumbHeight: 25, rules: true, paddedNumbers: true,
  titleFont: 'serif', textScale: 1, tracking: 0, gapScale: 1,
};

const CONTENTS_LAYOUTS: ContentsLayout[] = ['feature', 'sections'];
const CONTENTS_DENSITIES: ContentsDensity[] = ['auto', 'airy', 'normal', 'dense', 'packed'];
const clampNumber = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;
const colorOr = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[0-9a-f]{3,8}$/iu.test(value.trim()) ? value.trim() : fallback;

/** Always hand the page a complete design, whatever a stored plan happens to
 * carry: an issue saved by an older build has no contents design at all. */
export function contentsDesignOf(plan: Pick<IssuePlan, 'contentsDesign'>): ContentsDesign {
  const stored = plan.contentsDesign ?? {};
  const base = DEFAULT_CONTENTS_DESIGN;
  return {
    layout: CONTENTS_LAYOUTS.includes(stored.layout as ContentsLayout) ? stored.layout as ContentsLayout : base.layout,
    density: CONTENTS_DENSITIES.includes(stored.density as ContentsDensity) ? stored.density as ContentsDensity : base.density,
    accent: colorOr(stored.accent, base.accent),
    headingColor: colorOr(stored.headingColor, base.headingColor),
    columns: stored.columns === 1 || stored.columns === 2 ? stored.columns : base.columns,
    showHeroes: typeof stored.showHeroes === 'boolean' ? stored.showHeroes : base.showHeroes,
    pageLabels: typeof stored.pageLabels === 'boolean' ? stored.pageLabels : base.pageLabels,
    featureHeight: clampNumber(stored.featureHeight, 20, 150, base.featureHeight),
    thumbHeight: clampNumber(stored.thumbHeight, 8, 90, base.thumbHeight),
    rules: typeof stored.rules === 'boolean' ? stored.rules : base.rules,
    paddedNumbers: typeof stored.paddedNumbers === 'boolean' ? stored.paddedNumbers : base.paddedNumbers,
    titleFont: stored.titleFont === 'sans' ? 'sans' : base.titleFont,
    textScale: clampNumber(stored.textScale, 0.85, 1.15, base.textScale),
    tracking: clampNumber(stored.tracking, -0.02, 0.04, base.tracking),
    gapScale: clampNumber(stored.gapScale, 0.7, 1.3, base.gapScale),
  };
}
export interface IssueItem { id: string; name: string; version: number; updated: number; doc: Doc }
export interface IssueAssignment { id: string; startNumber: number; pageCount: number; counted: boolean }
export interface ContentsEntry {
  id: string; title: string; subtitle: string; page: number;
  hero?: Asset; badge?: string; section?: string; frame?: ImageFrame; pageLabel?: boolean;
  /** Resolved per-entry answer to "does this line show a picture", already
   * combined with the spread-wide switch. Absent = follow the spread. */
  showHero?: boolean;
}
export interface IssueResponse {
  project: { id: string; name: string }; version: number; plan: IssuePlan | null; items: IssueItem[];
  sourcesChanged?: boolean;
  finalized?: { at: number; contentsStartNumber: number; documents: { id: string; version: number; pageCount: number; startNumber: number }[] } | null;
}
export const isIssueCover = (doc: Doc) => doc.templateId === 'magazine-4' || doc.templateId === 'backcover-1';
export const issuePlainText = (text = '') => parseRuns(text).map(run => run.text).join('').replace(/\s+/gu, ' ').trim();

/**
 * A contents deck is a cue, not the article's standfirst — but the answer to a
 * long subtitle is to fit it, not to throw it away: an entry with no deck tells
 * the reader nothing about the article.
 *
 * So fitting is split in two. The visible fit is CSS's business: every deck is
 * line-clamped to its slot in contents.css, which makes each entry's height
 * deterministic no matter what the editor typed, so a long subtitle can never
 * push the entries under it off a sheet that cannot grow. This function only
 * bounds what reaches the DOM at all, cutting on a word boundary so the clamp
 * never has to render a half-word before the fade.
 */
export const CONTENTS_DECK_MAX = 240;
export const contentsDeck = (text: string | undefined, limit = CONTENTS_DECK_MAX) => {
  const deck = issuePlainText(text);
  if (deck.length <= limit) return deck;
  const cut = deck.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\u2013\u2014-]+$/u, '')}\u2026`;
};

export function defaultIssuePlan(items: readonly IssueItem[]): IssuePlan {
  return {
    order: [
      ...items.filter(item => item.doc.templateId === 'magazine-4').map(item => item.id), CONTENTS_ID,
      ...items.filter(item => !isIssueCover(item.doc)).map(item => item.id),
      ...items.filter(item => item.doc.templateId === 'backcover-1').map(item => item.id),
    ],
    startNumber: 1, countCovers: false, contentsTitle: 'Contents',
    contentsSubtitle: 'Ideas, discoveries and the people behind them.',
    direction: items.find(item => !isIssueCover(item.doc))?.doc.design.textDirection === 'rtl' ? 'rtl' : 'ltr',
    contentsExcluded: items.filter(item => isIssueCover(item.doc) || item.doc.templateId === 'frontmatter-contents').map(item => item.id),
  };
}

/** Reconcile membership after an explicit reload; retain the editor's order. */
export function reconcileIssuePlan(plan: IssuePlan, items: readonly IssueItem[]): IssuePlan {
  const ids = new Set(items.map(item => item.id));
  const seen = new Set<string>();
  const order = plan.order.filter(id => {
    if ((id !== CONTENTS_ID && !ids.has(id)) || seen.has(id)) return false;
    seen.add(id); return true;
  });
  if (!seen.has(CONTENTS_ID)) { order.unshift(CONTENTS_ID); seen.add(CONTENTS_ID); }
  const added = items.filter(item => !seen.has(item.id));
  for (const item of added) {
    if (item.doc.templateId === 'magazine-4') order.unshift(item.id);
    else if (item.doc.templateId === 'backcover-1') order.push(item.id);
    else {
      const back = order.findIndex(id => items.find(source => source.id === id)?.doc.templateId === 'backcover-1');
      order.splice(back < 0 ? order.length : back, 0, item.id);
    }
  }
  return { ...plan, order, contentsExcluded: [...new Set([...plan.contentsExcluded.filter(id => ids.has(id)), ...added.filter(item => isIssueCover(item.doc) || item.doc.templateId === 'frontmatter-contents').map(item => item.id)])] };
}

export function assignIssuePages(plan: IssuePlan, items: readonly IssueItem[], counts: Record<string, number>): IssueAssignment[] {
  const sources = new Map(items.map(item => [item.id, item]));
  if (plan.order.length !== items.length + 1 || new Set(plan.order).size !== plan.order.length || !plan.order.includes(CONTENTS_ID) || plan.order.some(id => id !== CONTENTS_ID && !sources.has(id))) throw new Error('The arrangement must contain every article and one contents spread.');
  if (!Number.isSafeInteger(plan.startNumber) || plan.startNumber < 0 || plan.startNumber > 99999) throw new Error('Choose a starting page from 0 to 99999.');
  let cursor = plan.startNumber;
  return plan.order.map(id => {
    const count = id === CONTENTS_ID ? 2 : counts[id];
    if (!Number.isSafeInteger(count) || count < 1) throw new Error(`The pages for ${sources.get(id)?.name ?? id} have not been measured.`);
    const counted = id === CONTENTS_ID || plan.countCovers || !isIssueCover(sources.get(id)!.doc);
    const result = { id, startNumber: cursor, pageCount: count, counted };
    if (counted) cursor += count;
    if (!Number.isSafeInteger(cursor) || cursor > 100000) throw new Error('This issue exceeds page 99999. Choose a smaller starting number.');
    return result;
  });
}

/** Every picture in an article, in the order the contents would reach for them,
 * so the designer can offer a real choice instead of only the automatic pick. */
export function issueHeroChoices(doc: Doc): { id: string; asset: Asset }[] {
  const useCover = doc.templateId?.startsWith('magazine') || doc.templateId?.startsWith('frontmatter');
  const frames = useCover ? [doc.cover?.assetId, doc.hero?.assetId] : [doc.hero?.assetId, doc.cover?.assetId];
  const figures = doc.blocks.flatMap(block => (block.type === 'figure' && block.assetId ? [block.assetId] : []));
  const ordered = [
    ...frames,
    ...(doc.news?.stories ?? []).map(story => story.assetId),
    ...figures,
    ...(doc.images ?? []).map(image => image.assetId),
    ...Object.keys(doc.assets ?? {}),
  ];
  const seen = new Set<string>();
  const choices: { id: string; asset: Asset }[] = [];
  for (const id of ordered) {
    if (!id || seen.has(id)) continue;
    const asset = doc.assets?.[id];
    if (!asset?.src) continue;
    seen.add(id);
    choices.push({ id, asset });
  }
  return choices;
}

export function issueHero(doc: Doc): Asset | undefined {
  return issueHeroChoices(doc)[0]?.asset;
}

/**
 * Which heading a contents line sits under.
 *
 * The article already announces its own section on the page itself: the top
 * bar running across the head of every sheet ("Research highlights", "In
 * focus", "People"). That bar is the magazine's section system, so the
 * contents page reads from it rather than asking the editor to retype the
 * same words into a second field — arrange the issue, and the sectioned
 * contents groups itself the way the printed pages already do. A per-entry
 * Section override still wins where an editor wants the contents to depart
 * from the page, and covers/front matter (no top bar) simply carry none.
 */
export function issueSection(item: IssueItem, style: ContentsEntryStyle = {}): string | undefined {
  const explicit = issuePlainText(style.section);
  if (explicit) return explicit;
  if (isIssueCover(item.doc)) return undefined;
  return issuePlainText(item.doc.meta.masthead) || undefined;
}

export function contentsEntries(plan: IssuePlan, items: readonly IssueItem[], assignments: readonly IssueAssignment[]): ContentsEntry[] {
  const sources = new Map(items.map(item => [item.id, item]));
  const pages = new Map(assignments.map(item => [item.id, item.startNumber]));
  return plan.order.filter(id => id !== CONTENTS_ID && !plan.contentsExcluded.includes(id)).map(id => {
    const item = sources.get(id);
    const page = pages.get(id);
    if (!item || page === undefined) throw new Error('Prepare every article before generating contents.');
    // The article supplies the defaults; the issue's own contents style wins
    // wherever the editor has set one, so rewording a contents line or
    // recropping its picture never edits the article.
    const style = plan.contentsStyle?.[id] ?? {};
    const chosen = style.assetId === null ? undefined
      : style.assetId ? item.doc.assets?.[style.assetId] ?? issueHero(item.doc)
      : issueHero(item.doc);
    return {
      id,
      title: issuePlainText(style.title) || issuePlainText(item.doc.meta.title) || item.name.replace(/\.json$/iu, ''),
      subtitle: contentsDeck(style.deck ?? item.doc.meta.subtitle),
      page,
      hero: chosen?.src ? chosen : undefined,
      badge: issuePlainText(style.badge) || undefined,
      section: issueSection(item, style),
      frame: style.frame ? normalizeImageFrame(style.frame) : undefined,
      pageLabel: style.pageLabel,
      showHero: typeof style.hero === 'boolean' ? style.hero : undefined,
    };
  });
}

export function documentWithIssueNumber(doc: Doc, startNumber: number): Doc {
  return { ...doc, footer: { ...doc.footer, startNumber }, ...(doc.frontMatter ? { frontMatter: { ...doc.frontMatter, pageStart: startNumber } } : {}) };
}

export function reorderIssue(order: readonly string[], activeId: string, targetId: string): string[] {
  const from = order.indexOf(activeId), to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return [...order];
  const result = [...order]; result.splice(from, 1); result.splice(to, 0, activeId); return result;
}
