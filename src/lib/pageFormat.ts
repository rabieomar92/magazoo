import type { Design, Doc } from '../schema/document';
import { PDF_PAGE_SIZES, type PdfPageSize } from './pdfPageSize';

export const MAGAZINE_PAGE = { width: 203, height: 267 } as const;

/** Physical layout dimensions, not a scale or a crop of an A4 composition. */
export function pageDimensions(design?: Pick<Design, 'pageFormat'|'bleedMm'|'bleedCanvas'>): { width: number; height: number } {
  const size = PDF_PAGE_SIZES[design?.pageFormat ?? 'a4'] ?? PDF_PAGE_SIZES.a4;
  const bleed=design?.bleedCanvas?Math.max(0,Math.min(10,design.bleedMm??0)):0;
  return { width: size.width+2*bleed, height: size.height+2*bleed };
}

/** Output-only view model. Never write a paper choice into an author's JSON. */
export function withPageFormat(doc: Doc, size: PdfPageSize): Doc {
  const pageFormat = size;
  if (doc.design.pageFormat === pageFormat) return doc;
  return { ...doc, design: { ...doc.design, pageFormat } };
}
