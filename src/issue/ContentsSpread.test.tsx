import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContentsSpread } from './ContentsSpread';
import { contentsDesignOf, DEFAULT_CONTENTS_DESIGN } from './model';
import { clonePages } from '../lib/pdfExport';
import { fitPdfSheets, PDF_PAGE_SIZES } from '../lib/pdfPageSize';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('applies all three colours to both sheets in every contents layout', () => {
  for (const layout of ['mosaic', 'feature', 'sections'] as const) {
    act(() => root.render(<ContentsSpread entries={[]} design={{ ...DEFAULT_CONTENTS_DESIGN, layout, pageColor: '#102030', textColor: '#ffffff', topBarColor: '#800080' }} />));
    const pages = [...host.querySelectorAll<HTMLElement>('.page')];
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.style.getPropertyValue('--contents-paper')).toBe('#102030');
      expect(page.style.getPropertyValue('--contents-ink')).toBe('#ffffff');
      expect(page.style.getPropertyValue('--contents-bar')).toBe('#800080');
      expect(page.style.getPropertyValue('--contents-bar-ink')).toBe('#f8fafc');
    }
  }
});

it('alternates physical masthead sides independently of folios and reading direction', () => {
  for (const layout of ['mosaic', 'feature', 'sections'] as const) for (const direction of ['ltr', 'rtl'] as const) {
    for (const mastheadSide of ['left', 'right'] as const) {
      act(() => root.render(<ContentsSpread entries={[]} startNumber={38} direction={direction} mastheadSide={mastheadSide} design={{ ...DEFAULT_CONTENTS_DESIGN, layout }} />));
      expect([...host.querySelectorAll('.issue-contents-masthead')].map(bar => bar.classList.contains('is-right')))
        .toEqual(mastheadSide === 'left' ? [false, true] : [true, false]);
    }
  }
});

it('loads older plans safely and normalises colour picker values', () => {
  expect(contentsDesignOf({})).toEqual(DEFAULT_CONTENTS_DESIGN);
  expect(contentsDesignOf({ contentsDesign: { pageColor: '#abc', textColor: '#12345', topBarColor: 'bad' } }))
    .toMatchObject({ pageColor: '#aabbcc', textColor: DEFAULT_CONTENTS_DESIGN.textColor, topBarColor: DEFAULT_CONTENTS_DESIGN.topBarColor });
});

it.each(['mosaic', 'feature', 'sections'] as const)('lays out both %s contents sheets at native Magazine dimensions and restores legacy size', layout => {
  const design = { ...DEFAULT_CONTENTS_DESIGN, layout };
  const before = JSON.stringify(design);
  for (const pageSize of ['magazine', 'a4', 'b5'] as const) {
    act(() => root.render(<ContentsSpread entries={[]} design={design} pageSize={pageSize} />));
    const pages = [...host.querySelectorAll<HTMLElement>('.issue-contents-page')];
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      const {width,height}=PDF_PAGE_SIZES[pageSize];
      expect(page.style.getPropertyValue('--page-w')).toBe(`${width}mm`);
      expect(page.style.getPropertyValue('--page-h')).toBe(`${height}mm`);
      expect(page.dataset.pageWidthMm).toBe(String(width));
      expect(page.dataset.pageHeightMm).toBe(String(height));
      expect(page.style.transform).toBe('');
    }
  }
  expect(JSON.stringify(design)).toBe(before);
});

it.each(['mosaic', 'feature', 'sections'] as const)('exports both native %s contents sheets at 100% with no fitting border', layout => {
  act(() => root.render(<ContentsSpread entries={[]} design={{ ...DEFAULT_CONTENTS_DESIGN, layout }} pageSize="magazine" />));
  const printDocument = document.implementation.createHTMLDocument('Native contents export');
  clonePages(host, printDocument, { freezeColumns: false });
  expect(() => fitPdfSheets(printDocument, 'magazine')).not.toThrow();
  const sheets = [...printDocument.querySelectorAll<HTMLElement>('.pdf-export-sheet > .pdf-export-page')];
  expect(sheets).toHaveLength(2);
  for (const page of sheets) {
    expect(page.style.width).toBe('203mm');
    expect(page.style.height).toBe('267mm');
    expect(page.style.getPropertyValue('--pdf-fit-scale')).toBe('1');
    expect(page.style.getPropertyValue('--pdf-fit-left')).toBe('0mm');
    expect(page.style.getPropertyValue('--pdf-fit-top')).toBe('0mm');
  }
});
