import { describe, expect, it } from 'vitest';
import { clonePages, cssImageUrls, PDF_EXPORT_CSS } from './pdfExport';

describe('PDF export layout contract', () => {
  it('prints only visible sheets and retains Arabic and drop-cap settings',()=>{
    const source=document.createElement('div');
    source.className='pages pages--spread pages--rtl drop-caps-off';source.lang='ar';
    source.innerHTML='<div class="page news-page">First</div><div class="page news-page">Second</div><div class="news-measure"><div class="page">Hidden measure</div></div>';
    document.body.append(source);
    const target=document.implementation.createHTMLDocument('print');
    clonePages(source,target);
    const pages=target.querySelector('.pages')!;
    expect(pages.children.length).toBe(2);
    expect(pages.textContent).toBe('FirstSecond');
    expect(pages.getAttribute('lang')).toBe('ar');
    expect(pages.classList.contains('pages--rtl')).toBe(true);
    expect(pages.classList.contains('drop-caps-off')).toBe(true);
    expect(pages.classList.contains('pages--spread')).toBe(false);
    source.remove();
  });
  it('prints the live page DOM instead of raster snapshots', () => {
    expect(PDF_EXPORT_CSS).toContain('.pdf-export-pages');
    expect(PDF_EXPORT_CSS).toContain('.pdf-export-page');
    expect(PDF_EXPORT_CSS).not.toContain('.pdf-page-snapshot');
  });

  it('maps every page to exact portrait A4 geometry', () => {
    expect(PDF_EXPORT_CSS).toContain('width: 210mm !important');
    expect(PDF_EXPORT_CSS).toContain('height: 297mm !important');
  });

  it('finds CSS background resources used by gallery and magazine pages', () => {
    expect(
      cssImageUrls(
        'linear-gradient(#000, #fff), url("data:image/png;base64,abc"), url( /photo.webp )',
      ),
    ).toEqual(['data:image/png;base64,abc', '/photo.webp']);
  });
});
