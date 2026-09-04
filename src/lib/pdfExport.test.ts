import { describe, expect, it } from 'vitest';
import { PDF_EXPORT_CSS } from './pdfExport';

describe('PDF export layout contract', () => {
  it('preserves each template page display mode', () => {
    const pageRule = PDF_EXPORT_CSS.match(/\.pdf-pages > \.page\s*\{([\s\S]*?)\}/)?.[1];

    expect(pageRule).toBeDefined();
    expect(pageRule).not.toMatch(/\bdisplay\s*:/);
  });

  it('removes preview chrome without changing physical A4 geometry', () => {
    expect(PDF_EXPORT_CSS).toContain('width: 210mm !important');
    expect(PDF_EXPORT_CSS).toContain('height: 297mm !important');
    expect(PDF_EXPORT_CSS).toContain('box-shadow: none !important');
    expect(PDF_EXPORT_CSS).toContain('transform: none !important');
  });
});
