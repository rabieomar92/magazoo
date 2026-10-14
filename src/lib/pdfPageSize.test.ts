import { describe, expect, it } from 'vitest';
import { cloneIssuePages, clonePages } from './pdfExport';
import { fitPdfSheets, pdfSheetGeometry } from './pdfPageSize';

describe('ISO B5 PDF fitting', () => {
  it('fits all four A4 corners inside B5 without distortion or crop', () => {
    const g = pdfSheetGeometry('b5');
    expect(g.width).toBe(176); expect(g.height).toBe(250);
    expect(g.scale).toBeCloseTo(176 / 210, 12);
    expect(g.left).toBeGreaterThanOrEqual(0); expect(g.top).toBeGreaterThan(0);
    expect(g.left + 210 * g.scale).toBeLessThanOrEqual(g.width);
    expect(g.top + 297 * g.scale).toBeLessThanOrEqual(g.height);
    expect(pdfSheetGeometry('a4')).toEqual({ width: 210, height: 297, scale: 1, left: 0, top: 0 });
  });
  it('preserves page markup, text, images, order, and one break per sheet across articles', () => {
    const sources = [document.createElement('div'), document.createElement('div')];
    sources[0].innerHTML = '<div class="page" style="display:grid"><p>Cover</p><img src="/photo.png" /></div><div class="page"><p>Page two</p></div>';
    sources[1].innerHTML = '<div class="page" style="display:flex"><p>Another article</p></div>';
    const output = document.implementation.createHTMLDocument();
    cloneIssuePages(sources, output);
    const originals = sources.map(s => s.outerHTML);
    fitPdfSheets(output, 'b5');
    const sheets = [...output.querySelectorAll<HTMLElement>('.pdf-export-sheet')];
    expect(sheets).toHaveLength(3);
    expect(sheets.map(s => s.textContent)).toEqual(['Cover', 'Page two', 'Another article']);
    expect(sheets.map(s => s.style.breakAfter)).toEqual(['page', 'page', 'auto']);
    expect(output.querySelectorAll('canvas')).toHaveLength(0);
    expect(output.querySelectorAll('img')).toHaveLength(1);
    expect([...output.querySelectorAll<HTMLElement>('.page')].map(p => p.style.width)).toEqual(['210mm', '210mm', '210mm']);
    expect(output.head.textContent).toContain('size: 176mm 250mm');
    expect(sources.map(s => s.outerHTML)).toEqual(originals);
  });
  it('leaves the original A4 export unchanged', () => {
    const source = document.createElement('div'); source.innerHTML = '<div class="page">A4</div>';
    const output = document.implementation.createHTMLDocument(); clonePages(source, output);
    const before = output.documentElement.outerHTML;
    fitPdfSheets(output, 'a4');
    expect(output.documentElement.outerHTML).toBe(before);
  });
  it.each(['a4','b5'] as const)('fits mixed 276mm and A4 artwork onto %s without cropping', size => {
    const source = document.createElement('div');
    source.innerHTML = '<div class="page" data-page-height-mm="276">Reference trim</div><div class="page">A4 trim</div>';
    const output = document.implementation.createHTMLDocument();
    clonePages(source, output);
    fitPdfSheets(output, size);
    const pages = [...output.querySelectorAll<HTMLElement>('.pdf-export-page')];
    expect(pages.map(p => p.style.height)).toEqual(['276mm','297mm']);
    expect(output.querySelectorAll('.pdf-export-sheet')).toHaveLength(2);
    for (const h of [276,297]) {
      const fit = pdfSheetGeometry(size, h);
      expect(fit.top + h * fit.scale).toBeLessThanOrEqual(fit.height + .00001);
      expect(fit.left + 210 * fit.scale).toBeLessThanOrEqual(fit.width + .00001);
    }
  });
});
