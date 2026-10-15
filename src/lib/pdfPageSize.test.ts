import { describe, expect, it } from 'vitest';
import { cloneIssuePages, clonePages } from './pdfExport';
import { fitPdfSheets, PDF_PAGE_SIZES, pdfSheetGeometry } from './pdfPageSize';

describe('PDF output sheet fitting', () => {
  it('fits all four A4 corners inside B5 without distortion or crop', () => {
    const g = pdfSheetGeometry('b5');
    expect(g.width).toBe(176); expect(g.height).toBe(250);
    expect(g.scale).toBeCloseTo(176 / 210, 12);
    expect(g.left).toBeGreaterThanOrEqual(0); expect(g.top).toBeGreaterThan(0);
    expect(g.left + 210 * g.scale).toBeLessThanOrEqual(g.width);
    expect(g.top + 297 * g.scale).toBeLessThanOrEqual(g.height);
    expect(pdfSheetGeometry('a4')).toEqual({ width: 210, height: 297, scale: 1, left: 0, top: 0 });
  });
  it('fits A4 artwork onto the exact 203 × 267 mm magazine sheet by height, without clipping its edges', () => {
    const g = pdfSheetGeometry('magazine');
    expect(g.width).toBe(203); expect(g.height).toBe(267);
    expect(g.scale).toBeCloseTo(267 / 297, 12);
    expect(g.left).toBeCloseTo((203 - 210 * g.scale) / 2, 12);
    expect(g.left).toBeGreaterThan(0); expect(g.top).toBe(0);
    expect(g.left + 210 * g.scale).toBeLessThanOrEqual(g.width);
    expect(g.top + 297 * g.scale).toBeCloseTo(g.height, 12);
  });
  it('fits reference artwork onto the magazine sheet by width instead of stretching it to A4 proportions', () => {
    const g = pdfSheetGeometry('magazine', 276);
    expect(g.scale).toBeCloseTo(203 / 210, 12);
    expect(g.left).toBe(0); expect(g.top).toBeCloseTo(.1, 12);
    expect(g.top + 276 * g.scale).toBeLessThanOrEqual(g.height);
  });
  it.each(['b5', 'magazine'] as const)('preserves page markup, text, images, order, and one break per %s sheet across articles', size => {
    const sources = [document.createElement('div'), document.createElement('div')];
    sources[0].innerHTML = '<div class="page" style="display:grid"><p>Cover</p><img src="/photo.png" /></div><div class="page"><p>Page two</p></div>';
    sources[1].innerHTML = '<div class="page" style="display:flex"><p>Another article</p></div>';
    const output = document.implementation.createHTMLDocument();
    cloneIssuePages(sources, output);
    const originals = sources.map(s => s.outerHTML);
    fitPdfSheets(output, size);
    const sheets = [...output.querySelectorAll<HTMLElement>('.pdf-export-sheet')];
    expect(sheets).toHaveLength(3);
    expect(sheets.map(s => s.textContent)).toEqual(['Cover', 'Page two', 'Another article']);
    expect(sheets.map(s => s.style.breakAfter)).toEqual(['page', 'page', 'auto']);
    expect(output.querySelectorAll('canvas')).toHaveLength(0);
    expect(output.querySelectorAll('img')).toHaveLength(1);
    expect([...output.querySelectorAll<HTMLElement>('.page')].map(p => p.style.width)).toEqual(['210mm', '210mm', '210mm']);
    const { width, height } = PDF_PAGE_SIZES[size];
    expect(sheets.every(sheet => sheet.dataset.paperSize === size)).toBe(true);
    expect(output.head.textContent).toContain(`size: ${width}mm ${height}mm`);
    expect(sources.map(s => s.outerHTML)).toEqual(originals);
  });
  it('leaves the original A4 export unchanged', () => {
    const source = document.createElement('div'); source.innerHTML = '<div class="page">A4</div>';
    const output = document.implementation.createHTMLDocument(); clonePages(source, output);
    const before = output.documentElement.outerHTML;
    fitPdfSheets(output, 'a4');
    expect(output.documentElement.outerHTML).toBe(before);
  });
  it.each(['a4','b5','magazine'] as const)('fits mixed 276mm and A4 artwork onto %s without cropping', size => {
    const source = document.createElement('div');
    source.innerHTML = '<div class="page" data-page-height-mm="276">Reference trim</div><div class="page">A4 trim</div>';
    const output = document.implementation.createHTMLDocument();
    clonePages(source, output);
    fitPdfSheets(output, size);
    const pages = [...output.querySelectorAll<HTMLElement>('.pdf-export-page')];
    expect(pages.map(p => p.style.height)).toEqual(['276mm','297mm']);
    expect(output.querySelectorAll('.pdf-export-sheet')).toHaveLength(2);
    for (const [index, h] of [276,297].entries()) {
      const fit = pdfSheetGeometry(size, h);
      expect(fit.left).toBeGreaterThanOrEqual(0);
      expect(fit.top).toBeGreaterThanOrEqual(0);
      expect(fit.top + h * fit.scale).toBeLessThanOrEqual(fit.height + .00001);
      expect(fit.left + 210 * fit.scale).toBeLessThanOrEqual(fit.width + .00001);
      expect(pages[index].style.getPropertyValue('--pdf-fit-scale')).toBe(String(fit.scale));
      expect(pages[index].style.getPropertyValue('--pdf-fit-left')).toBe(`${fit.left}mm`);
      expect(pages[index].style.getPropertyValue('--pdf-fit-top')).toBe(`${fit.top}mm`);
    }
  });
  it('extends dark page colour into magazine sheet margins without changing the original preview', () => {
    const source = document.createElement('div');
    source.style.transform = 'scale(0.5)';
    source.innerHTML = '<div class="page" style="background-color: rgb(20, 24, 31)"><p>Dark cover</p></div>';
    document.body.append(source);
    const original = source.outerHTML;
    // A real print iframe has a Window; use this document to exercise computed colour.
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const printDocument = iframe.contentDocument!;
    try {
      clonePages(source, printDocument);
      fitPdfSheets(printDocument, 'magazine');
      expect(printDocument.querySelector<HTMLElement>('.pdf-export-sheet')!.style.backgroundColor).toBe('rgb(20, 24, 31)');
      expect(source.outerHTML).toBe(original);
    } finally { iframe.remove(); source.remove(); }
  });
});
