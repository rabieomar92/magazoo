import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { assignIssuePages, CONTENTS_DECK_MAX, contentsEntries, defaultIssuePlan, documentWithIssueNumber, issueSection, reconcileIssuePlan, reorderIssue, type IssueItem } from './model';

const item = (id: string, templateId: IssueItem['doc']['templateId'] = 'paper-1'): IssueItem => ({ id, name: `${id}.json`, version: 1, updated: 0, doc: { ...emptyDoc(), templateId } });
describe('issue numbering and preservation', () => {
  it('counts all physical sheets including gallery spreads and two generated contents pages', () => {
    const items = [item('back', 'backcover-1'), item('article'), item('gallery', 'gallery-1'), item('cover', 'magazine-4')];
    const plan = defaultIssuePlan(items);
    expect(plan.order).toEqual(['cover', '__contents__', 'article', 'gallery', 'back']);
    const counts = { cover: 1, article: 3, gallery: 2, back: 1 };
    expect(assignIssuePages(plan, items, counts).map(row => row.startNumber)).toEqual([1, 1, 3, 6, 8]);
    expect(assignIssuePages({ ...plan, countCovers: true }, items, counts).map(row => row.startNumber)).toEqual([1, 2, 4, 7, 9]);
    const reordered = { ...plan, order: reorderIssue(plan.order, 'gallery', 'article') };
    expect(assignIssuePages(reordered, items, counts).map(row => [row.id, row.startNumber])).toContainEqual(['article', 5]);
  });
  it('never guesses page counts or accepts duplicate/missing articles', () => {
    const items = [item('a')], plan = defaultIssuePlan(items);
    expect(() => assignIssuePages(plan, items, {})).toThrow('not been measured');
    expect(() => assignIssuePages({ ...plan, order: ['a', 'a'] }, items, { a: 1 })).toThrow();
    expect(() => assignIssuePages({ ...plan, startNumber: 99999 }, items, { a: 1 })).toThrow('99999');
  });
  it('reconciles additions and deletions while preserving existing order', () => {
    const a = item('a'), b = item('b'), back = item('back', 'backcover-1');
    const plan = defaultIssuePlan([a, b, back]);
    const revised = reconcileIssuePlan({ ...plan, order: ['b', '__contents__', 'a', 'back'] }, [a, back, item('new')]);
    expect(revised.order).toEqual(['__contents__', 'a', 'new', 'back']);
    expect(new Set(revised.order).size).toBe(revised.order.length);
  });
  it('keeps every subtitle, trimming only what could never reach the sheet', () => {
    const short = item('short'), long = item('long');
    short.doc.meta.subtitle = 'A new perspective on trapped ions';
    long.doc.meta.subtitle = 'Researchers at the School of Physics have demonstrated a new approach to laser cooling that reaches the microkelvin regime using a fraction of the optical power previously required, opening a route to portable optical clocks that survive a van ride.';
    expect(long.doc.meta.subtitle.length).toBeGreaterThan(CONTENTS_DECK_MAX);
    const plan = defaultIssuePlan([short, long]);
    const [first, second] = contentsEntries(plan, [short, long], assignIssuePages(plan, [short, long], { short: 1, long: 1 }));
    expect(first.subtitle).toBe('A new perspective on trapped ions');
    // Trimmed on a word boundary, never mid-word, and never emptied: the deck
    // is what tells a reader what the article is. CSS clamps what shows.
    expect(second.subtitle.length).toBeLessThanOrEqual(CONTENTS_DECK_MAX + 1);
    expect(second.subtitle.endsWith('\u2026')).toBe(true);
    expect(second.subtitle).toMatch(/^Researchers at the School of Physics/u);
    expect(second.subtitle.replace(/\u2026$/u, '').endsWith(' ')).toBe(false);
    expect(long.doc.meta.subtitle).toMatch(/van ride\.$/u);
  });
  it('extracts authored text and the appropriate hero without altering the JSON', () => {
    const a = item('a', 'magazine-3');
    a.doc.meta.title = '**عالم الضوء**'; a.doc.meta.subtitle = 'A *new* perspective';
    a.doc.assets.hero = { src: 'hero.jpg', naturalWidth: 20, naturalHeight: 10 };
    a.doc.assets.cover = { src: 'cover.jpg', naturalWidth: 20, naturalHeight: 10 };
    a.doc.hero.assetId = 'hero'; a.doc.cover = { assetId: 'cover', scale: 1, offsetX: 0, offsetY: 0 };
    const before = JSON.stringify(a), plan = defaultIssuePlan([a]);
    // The hero is carried as the asset itself, so the contents can crop and
    // frame it the way the article templates do rather than just showing a src.
    expect(contentsEntries(plan, [a], assignIssuePages(plan, [a], { a: 4 }))).toEqual([{
      id: 'a', title: 'عالم الضوء', subtitle: 'A new perspective', page: 3,
      hero: { src: 'cover.jpg', naturalWidth: 20, naturalHeight: 10 },
      badge: undefined, section: undefined, frame: undefined, pageLabel: undefined,
    }]);
    const numbered = documentWithIssueNumber(a.doc, 13);
    expect(numbered.footer?.startNumber).toBe(13);
    expect(numbered.blocks).toBe(a.doc.blocks);
    expect(JSON.stringify(a)).toBe(before);
  });
});

describe('contents lines follow the pages they describe', () => {
  const withMasthead = (id: string, masthead: string, templateId: IssueItem['doc']['templateId'] = 'paper-1'): IssueItem => {
    const base = item(id, templateId);
    return { ...base, doc: { ...base.doc, meta: { ...base.doc.meta, masthead } } };
  };

  it('takes each entry’s section from the article’s own top bar, and lets the issue overrule it', () => {
    const items = [withMasthead('a', 'Research highlights'), withMasthead('b', 'Research highlights'), withMasthead('c', 'In focus')];
    const plan = { ...defaultIssuePlan(items), contentsStyle: { c: { section: 'People' } } };
    const assignments = assignIssuePages(plan, items, { a: 1, b: 1, c: 1 });
    expect(contentsEntries(plan, items, assignments).map(entry => entry.section))
      .toEqual(['Research highlights', 'Research highlights', 'People']);
    // A cover has no top bar to read, so it contributes no section at all.
    expect(issueSection(item('cover', 'magazine-4'))).toBeUndefined();
    expect(issueSection(withMasthead('a', '  Research  highlights '))).toBe('Research highlights');
  });

  it('lets one entry keep or drop its picture independently of the spread', () => {
    const items = [item('a'), item('b')];
    const plan = { ...defaultIssuePlan(items), contentsStyle: { a: { hero: false }, b: { hero: true } } };
    const assignments = assignIssuePages(plan, items, { a: 1, b: 1 });
    expect(contentsEntries(plan, items, assignments).map(entry => entry.showHero)).toEqual([false, true]);
    // No override means "follow the spread-wide switch", not "off".
    const plain = { ...defaultIssuePlan(items) };
    expect(contentsEntries(plain, items, assignIssuePages(plain, items, { a: 1, b: 1 })).map(entry => entry.showHero))
      .toEqual([undefined, undefined]);
  });
});
