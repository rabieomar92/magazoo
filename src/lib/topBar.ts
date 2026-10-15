import type { Doc } from '../schema/document';

/** One physical rule height for every running masthead and its flow clearance. */
export const TOP_BAR_HEIGHT_MM = 6;

export function topBarVisible(doc: Pick<Doc, 'design' | 'templateId'>): boolean {
  return doc.design.showTopBar ?? (doc.templateId !== 'magazine-4' && doc.templateId !== 'backcover-1');
}
