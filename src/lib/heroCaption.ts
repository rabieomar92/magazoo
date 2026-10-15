import type { Doc } from '../schema/document';

/** Never borrow a description from a different photograph. Cover-only legacy
 * files used heroCaption before a separate cover caption was available. */
export function heroCaptionText(doc: Doc, cover = false): string {
  if (!cover || doc.templateId === 'frontmatter-board') return doc.meta.heroCaption ?? '';
  if (doc.meta.coverCaption !== undefined) return doc.meta.coverCaption;
  const sameImage = !doc.cover?.assetId || doc.cover.assetId === doc.hero.assetId;
  const coverOnly = doc.templateId === 'magazine-3' || doc.templateId === 'magazine-4';
  return sameImage || coverOnly ? doc.meta.heroCaption ?? '' : '';
}
