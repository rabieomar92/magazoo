import type { Doc } from '../schema/document';

export function topBarVisible(doc: Pick<Doc, 'design' | 'templateId'>): boolean {
  return doc.design.showTopBar ?? (doc.templateId !== 'magazine-4' && doc.templateId !== 'backcover-1');
}
