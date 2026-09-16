import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { assignIssuePages, contentsEntries, defaultIssuePlan, documentWithIssueNumber, reconcileIssuePlan, reorderIssue, type IssueItem } from './model';

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
  it('extracts authored text and the appropriate hero without altering the JSON', () => {
    const a = item('a', 'magazine-3');
    a.doc.meta.title = '**عالم الضوء**'; a.doc.meta.subtitle = 'A *new* perspective';
    a.doc.assets.hero = { src: 'hero.jpg', naturalWidth: 20, naturalHeight: 10 };
    a.doc.assets.cover = { src: 'cover.jpg', naturalWidth: 20, naturalHeight: 10 };
    a.doc.hero.assetId = 'hero'; a.doc.cover = { assetId: 'cover', scale: 1, offsetX: 0, offsetY: 0 };
    const before = JSON.stringify(a), plan = defaultIssuePlan([a]);
    expect(contentsEntries(plan, [a], assignIssuePages(plan, [a], { a: 4 }))).toEqual([{ id: 'a', title: 'عالم الضوء', subtitle: 'A new perspective', page: 3, hero: 'cover.jpg' }]);
    const numbered = documentWithIssueNumber(a.doc, 13);
    expect(numbered.footer?.startNumber).toBe(13);
    expect(numbered.blocks).toBe(a.doc.blocks);
    expect(JSON.stringify(a)).toBe(before);
  });
});
