import { expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { assignIssuePages, defaultIssuePlan, issueDocumentLabel, type IssueItem } from './model';
import { bindingPadding, bindingPageCounts } from './binding';

it('uses physical sides, includes contents/front matter, and excludes covers only from perfect-binding interiors', () => {
  const items: IssueItem[] = [
    ['front', 'magazine-4'], ['board', 'frontmatter-board'], ['story', 'paper-1'], ['back', 'backcover-1'],
  ].map(([id, templateId]) => ({id, name:id, version:1, updated:0, doc:{...emptyDoc(), templateId:templateId as IssueItem['doc']['templateId']}}));
  for (const countCovers of [false, true]) {
    const plan = {...defaultIssuePlan(items), countCovers, startNumber:17};
    const pages = bindingPageCounts(items, assignIssuePages(plan, items, {front:1, board:1, story:38, back:1}));
    expect(pages).toEqual({total:43, cover:2, interior:41});
    expect(bindingPadding(pages.total, 4)).toBe(1);
    expect(bindingPadding(pages.interior, 2)).toBe(1);
    expect(bindingPadding(pages.interior, 16)).toBe(7);
  }
  expect(issueDocumentLabel(items[0].doc)).toBe('Front cover');
  expect(issueDocumentLabel(items[1].doc)).toBe('Front matter · Editorial board');
  expect(issueDocumentLabel(items[3].doc)).toBe('Back cover');
  const allExcluded = {...defaultIssuePlan(items), contentsExcluded:items.map(item=>item.id)};
  expect(bindingPageCounts(items,assignIssuePages(allExcluded,items,{front:1,board:1,story:38,back:1})))
    .toEqual({total:43,cover:2,interior:41});
});

it('adds nothing to complete signatures and rounds up every incomplete signature', () => {
  for (const multiple of [2,4,8,16,32]) for (let pages=0;pages<100;pages++) {
    const extra=bindingPadding(pages,multiple);
    expect(extra).toBeGreaterThanOrEqual(0);
    expect(extra).toBeLessThan(multiple);
    expect((pages+extra)%multiple).toBe(0);
  }
});
