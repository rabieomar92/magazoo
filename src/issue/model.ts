import type { Doc } from '../schema/document';
import { parseRuns } from '../lib/richtext';

export const CONTENTS_ID = '__contents__';
export interface IssuePlan {
  order: string[]; startNumber: number; countCovers: boolean;
  contentsTitle: string; contentsSubtitle: string; direction: 'ltr' | 'rtl'; contentsExcluded: string[];
}
export interface IssueItem { id: string; name: string; version: number; updated: number; doc: Doc }
export interface IssueAssignment { id: string; startNumber: number; pageCount: number; counted: boolean }
export interface ContentsEntry { id: string; title: string; subtitle: string; page: number; hero?: string }
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

export function issueHero(doc: Doc): string | undefined {
  const useCover = doc.templateId?.startsWith('magazine') || doc.templateId?.startsWith('frontmatter');
  const frames = useCover ? [doc.cover?.assetId, doc.hero?.assetId] : [doc.hero?.assetId, doc.cover?.assetId];
  const figure = doc.blocks.find(block => block.type === 'figure');
  const ids = [...frames, doc.news?.stories.find(story => story.assetId)?.assetId, figure?.type === 'figure' ? figure.assetId : undefined, doc.images?.[0]?.assetId];
  for (const id of ids) if (id && doc.assets[id]?.src) return doc.assets[id].src;
  return undefined;
}

export function contentsEntries(plan: IssuePlan, items: readonly IssueItem[], assignments: readonly IssueAssignment[]): ContentsEntry[] {
  const sources = new Map(items.map(item => [item.id, item]));
  const pages = new Map(assignments.map(item => [item.id, item.startNumber]));
  return plan.order.filter(id => id !== CONTENTS_ID && !plan.contentsExcluded.includes(id)).map(id => {
    const item = sources.get(id);
    const page = pages.get(id);
    if (!item || page === undefined) throw new Error('Prepare every article before generating contents.');
    return { id, title: issuePlainText(item.doc.meta.title) || item.name.replace(/\.json$/iu, ''), subtitle: contentsDeck(item.doc.meta.subtitle), page, hero: issueHero(item.doc) };
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
