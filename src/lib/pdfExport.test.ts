import { describe, expect, it } from 'vitest';
import { cssImageUrls, PDF_CAPTURE_PIXEL_RATIO, PDF_EXPORT_CSS } from './pdfExport';

describe('PDF export layout contract', () => {
  it('prints immutable snapshots instead of reflowing template DOM', () => {
    expect(PDF_EXPORT_CSS).toContain('.pdf-page-snapshot');
    expect(PDF_EXPORT_CSS).not.toContain('.pdf-pages > .page');
    expect(PDF_CAPTURE_PIXEL_RATIO).toBeGreaterThanOrEqual(3);
  });

  it('maps every snapshot to exact portrait A4 geometry', () => {
    expect(PDF_EXPORT_CSS).toContain('width: 210mm !important');
    expect(PDF_EXPORT_CSS).toContain('height: 297mm !important');
    expect(PDF_EXPORT_CSS).toContain('object-fit: fill');
  });

  it('finds CSS background resources used by gallery and magazine pages', () => {
    expect(
      cssImageUrls(
        'linear-gradient(#000, #fff), url("data:image/png;base64,abc"), url( /photo.webp )',
      ),
    ).toEqual(['data:image/png;base64,abc', '/photo.webp']);
  });
});
