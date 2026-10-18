import { emptyDoc } from '../schema/document';
import type { ExternalIssuePdf, IssueItem } from './model';

export function withExternalPdfItems(articles: readonly IssueItem[], pdfs: readonly ExternalIssuePdf[] = []): IssueItem[] {
  return [...articles, ...pdfs.map(pdf => {
    const doc = emptyDoc();
    doc.meta.title = pdf.name.replace(/\.pdf$/iu, '');
    doc.meta.subtitle = '';
    if (pdf.thumbnail) {
      doc.assets['pdf-preview'] = { src: pdf.thumbnail, naturalWidth: 320, naturalHeight: 440 };
      doc.hero.assetId = 'pdf-preview';
    }
    return { id: pdf.id, name: pdf.name, version: 1, updated: 0, doc, externalPdf: pdf };
  })];
}
