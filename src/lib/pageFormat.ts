import type { Design, Doc } from '../schema/document';
import type { PdfPageSize } from './pdfPageSize';

export const MAGAZINE_PAGE = { width: 203, height: 267 } as const;
const A4_PAGE = { width: 210, height: 297 } as const;

/** Physical layout dimensions, not a scale or a crop of an A4 composition. */
export function pageDimensions(design?: Pick<Design, 'pageFormat'>): { width: number; height: number } {
  return design?.pageFormat === 'magazine' ? MAGAZINE_PAGE : A4_PAGE;
}

/** Output-only view model. Never write a paper choice into an author's JSON. */
export function withPageFormat(doc: Doc, size: PdfPageSize): Doc {
  const pageFormat = size === 'magazine' ? 'magazine' : undefined;
  if (doc.design.pageFormat === pageFormat) return doc;
  return { ...doc, design: { ...doc.design, pageFormat } };
}
