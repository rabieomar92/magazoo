import { describe, expect, it } from 'vitest';
import { cloneIssuePages, clonePages } from './pdfExport';
import { fitPdfSheets, PDF_PAGE_SIZES, pdfPageDimensions, pdfSheetGeometry } from './pdfPageSize';

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
  it('prints native 203 × 267 mm magazine artwork at 100% with no added bands', () => {
    const g = pdfSheetGeometry('magazine', 267, 203);
    expect(g.width).toBe(203); expect(g.height).toBe(267);
    expect(g.scale).toBe(1);
    expect(g.left).toBe(0); expect(g.top).toBe(0);
    expect(g.left + 203 * g.scale).toBe(g.width);
    expect(g.top + 267 * g.scale).toBe(g.height);
  });
  it.each(['', ' data-page-height-mm="276"'])('refuses a stale A4/reference preview for Magazine export before changing the print clone (%s)', attributes => {
    const source = document.createElement('div');
    source.innerHTML = `<div class="page"${attributes}>Legacy preview</div>`;
    const output = document.implementation.createHTMLDocument();
    clonePages(source, output);
    const before = output.documentElement.outerHTML;
    expect(() => fitPdfSheets(output, 'magazine')).toThrow('Magazine preview is not ready at 203 × 267 mm');
    expect(output.documentElement.outerHTML).toBe(before);
  });
  it.each(['a4','b5'] as const)('refuses to silently fit a stale reference trim onto %s',size=>{
    const source=document.createElement('div');source.innerHTML='<div class="page" data-page-height-mm="276">Exact canvas</div>';
    const output=document.implementation.createHTMLDocument();clonePages(source,output);const before=output.documentElement.outerHTML;
    expect(()=>fitPdfSheets(output,size)).toThrow('preview is not ready');expect(output.documentElement.outerHTML).toBe(before);
  });
  it.each(['b5', 'magazine'] as const)('preserves page markup, text, images, order, and one break per %s sheet across articles', size => {
    const sources = [document.createElement('div'), document.createElement('div')];
    const native=PDF_PAGE_SIZES[size];
    const trim = ` data-page-width-mm="${native.width}" data-page-height-mm="${native.height}"`;
    sources[0].innerHTML = `<div class="page"${trim} style="display:grid"><p>Cover</p><img src="/photo.png" /></div><div class="page"${trim}><p>Page two</p></div>`;
    sources[1].innerHTML = `<div class="page"${trim} style="display:flex"><p>Another article</p></div>`;
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
    const expectedWidth = `${native.width}mm`;
    expect([...output.querySelectorAll<HTMLElement>('.page')].map(p => p.style.width)).toEqual([expectedWidth, expectedWidth, expectedWidth]);
    {
      for (const page of output.querySelectorAll<HTMLElement>('.page')) {
        expect(page.style.height).toBe(`${native.height}mm`);
        expect(page.style.getPropertyValue('--pdf-fit-scale')).toBe('1');
        expect(page.style.getPropertyValue('--pdf-fit-left')).toBe('0mm');
        expect(page.style.getPropertyValue('--pdf-fit-top')).toBe('0mm');
      }
    }
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
  it.each([
    ['b5', 176, 250],
    ['magazine', 203, 267],
  ] as const)('anchors only opted-in bottom-bleed %s artwork (%s × %s) to the output bottom trim', (size, width, height) => {
    const source = document.createElement('div');
    source.innerHTML = `<div class="page page--hero-bottom-bleed" data-page-width-mm="${width}" data-page-height-mm="${height}"><p>Bleeding photograph</p><img src="/photo.png"/><figcaption>Retain this caption</figcaption><footer>1 · Magazoo!</footer></div>
      <div class="page" data-page-width-mm="${width}" data-page-height-mm="${height}">Normal sheet</div>`;
    source.style.transform = 'scale(0.5)';
    const original = source.outerHTML;
    const output = document.implementation.createHTMLDocument();
    clonePages(source, output);
    fitPdfSheets(output, size);
    const [bleed, normal] = [...output.querySelectorAll<HTMLElement>('.pdf-export-page')];
    const fit = pdfSheetGeometry(size, height, width);
    expect(parseFloat(bleed.style.getPropertyValue('--pdf-fit-top')) + height * fit.scale).toBeCloseTo(fit.height, 10);
    expect(bleed.style.getPropertyValue('--pdf-fit-scale')).toBe(String(fit.scale));
    expect(bleed.style.getPropertyValue('--pdf-fit-left')).toBe(`${fit.left}mm`);
    expect(normal.style.getPropertyValue('--pdf-fit-top')).toBe(`${fit.top}mm`);
    expect(normal.style.getPropertyValue('--pdf-fit-scale')).toBe(String(fit.scale));
    expect(bleed.querySelector('figcaption')?.textContent).toBe('Retain this caption');
    expect(bleed.querySelector('footer')?.textContent).toBe('1 · Magazoo!');
    expect(bleed.querySelector('img')?.getAttribute('src')).toBe('/photo.png');
    if (size === 'magazine') {
      expect(bleed.style.getPropertyValue('--pdf-fit-scale')).toBe('1');
      expect(bleed.style.getPropertyValue('--pdf-fit-top')).toBe('0mm');
      expect(bleed.style.getPropertyValue('--pdf-fit-left')).toBe('0mm');
    }
    expect(source.outerHTML).toBe(original);
  });
  it.each(['a4','b5'] as const)('rejects mixed trim sizes instead of adding invisible fit margins to %s', size => {
    const source = document.createElement('div');
    source.innerHTML = '<div class="page" data-page-height-mm="276">Reference trim</div><div class="page">A4 trim</div><div class="page" data-page-width-mm="203" data-page-height-mm="267">Native trim</div>';
    const output = document.implementation.createHTMLDocument();
    clonePages(source, output);
    const before=output.documentElement.outerHTML;
    expect(()=>fitPdfSheets(output,size)).toThrow('preview is not ready');
    expect(output.documentElement.outerHTML).toBe(before);
  });
  it('retains edge-to-edge dark native magazine paper without changing the original preview', () => {
    const source = document.createElement('div');
    source.style.transform = 'scale(0.5)';
    source.innerHTML = '<div class="page" data-page-width-mm="203" data-page-height-mm="267" style="background-color: rgb(20, 24, 31)"><p>Dark cover</p></div>';
    document.body.append(source);
    const original = source.outerHTML;
    // A real print iframe has a Window; use this document to exercise computed colour.
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const printDocument = iframe.contentDocument!;
    try {
      clonePages(source, printDocument);
      fitPdfSheets(printDocument, 'magazine');
      const sheet = printDocument.querySelector<HTMLElement>('.pdf-export-sheet')!;
      expect(sheet.style.backgroundColor).toBe('rgb(20, 24, 31)');
      const page = sheet.querySelector<HTMLElement>('.page')!;
      expect(page.style.getPropertyValue('--pdf-fit-scale')).toBe('1');
      expect(page.style.getPropertyValue('--pdf-fit-left')).toBe('0mm');
      expect(page.style.getPropertyValue('--pdf-fit-top')).toBe('0mm');
      expect(source.outerHTML).toBe(original);
    } finally { iframe.remove(); source.remove(); }
  });
  it('reads both native dimensions and retains legacy height-only reference metadata', () => {
    const page = document.createElement('div');
    expect(pdfPageDimensions(page)).toEqual({width:210,height:297});
    page.dataset.pageHeightMm = '276';
    expect(pdfPageDimensions(page)).toEqual({width:210,height:276});
    page.dataset.pageHeightMm = '267'; page.dataset.pageWidthMm = '203';
    expect(pdfPageDimensions(page)).toEqual({width:203,height:267});
  });
  it.each(['0', '-203', 'Infinity', 'NaN', '1000000', '', '203mm'])('rejects invalid or unsafe print width metadata: %s', width => {
    const source = document.createElement('div');
    source.innerHTML = '<div class="page">Text</div>';
    source.querySelector<HTMLElement>('.page')!.dataset.pageWidthMm = width;
    expect(() => clonePages(source, document.implementation.createHTMLDocument())).toThrow('invalid page width');
  });
  it.each(['0', '-267', 'Infinity', 'NaN', '1000000', '', '267mm'])('rejects invalid or unsafe print height metadata: %s', height => {
    const page = document.createElement('div'); page.dataset.pageHeightMm = height;
    expect(() => pdfPageDimensions(page)).toThrow('invalid page height');
  });
});
