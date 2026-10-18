import { isIssueCover, type IssueAssignment, type IssueItem } from './model';

/** Page sides, never sheets or printed folio numbers. No blanks are inserted. */
export function bindingPageCounts(items: readonly IssueItem[], assignments: readonly IssueAssignment[]) {
  const covers = new Set(items.filter(item => isIssueCover(item.doc)).map(item => item.id));
  const total = assignments.reduce((sum, row) => sum + row.pageCount, 0);
  const cover = assignments.filter(row => covers.has(row.id)).reduce((sum, row) => sum + row.pageCount, 0);
  return { total, cover, interior: total - cover };
}

export function bindingPadding(pages: number, multiple: number): number {
  if (!Number.isSafeInteger(pages) || pages < 0 || !Number.isSafeInteger(multiple) || multiple < 1) throw new Error('Invalid binding page count.');
  return (multiple - pages % multiple) % multiple;
}
