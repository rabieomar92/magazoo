/** Output sheets. Magazine pages are measured at their native trim size;
 * A4 and B5 can also fit artwork measured at another size. */
export type PdfPageSize = 'a4' | 'b5' | 'magazine';
export const PDF_PAGE_SIZES = {
  a4: { label: 'A4', width: 210, height: 297 },
  b5: { label: 'B5 (ISO)', width: 176, height: 250 },
  magazine: { label: 'Magazine', width: 203, height: 267 },
} as const;

function checkedDimension(value: string | undefined, fallback: number, name: string) {
  const dimension = value === undefined ? fallback : Number(value);
  // Page metadata is internal, but do not turn a corrupt/imported value into
  // an enormous print surface or silently clip it onto a different page size.
  if (!Number.isFinite(dimension) || dimension < 50 || dimension > 500) {
    throw new Error(`The preview has an invalid page ${name}. Reload it before exporting.`);
  }
  return dimension;
}

/** Dimensions belong to the measured preview, not to the chosen output sheet. */
export function pdfPageDimensions(page: HTMLElement) {
  return {
    width: checkedDimension(page.dataset.pageWidthMm, 210, 'width'),
    height: checkedDimension(page.dataset.pageHeightMm, 297, 'height'),
  };
}

export function pdfSheetGeometry(size: PdfPageSize, sourceHeight = 297, sourceWidth = 210) {
  checkedDimension(String(sourceWidth), 210, 'width');
  checkedDimension(String(sourceHeight), 297, 'height');
  const { width, height } = PDF_PAGE_SIZES[size];
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  return { width, height, scale, left: Math.max(0, (width - sourceWidth * scale) / 2), top: Math.max(0, (height - sourceHeight * scale) / 2) };
}

/** Called only on the print clone, after author styles have loaded. Never
 * change editor geometry, pagination, source images, or the compiled proof. */
export function fitPdfSheets(doc: Document, size: PdfPageSize) {
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('.pdf-export-page'));
  if (!pages.length) return;
  const dimensions = pages.map(pdfPageDimensions);
  if (size === 'magazine' && dimensions.some(page => page.width !== 203 || page.height !== 267)) {
    throw new Error('The Magazine preview is not ready at 203 × 267 mm. Wait for the layout to update and try again; an A4 page cannot be exported as a borderless Magazine page.');
  }
  if (size === 'a4' && dimensions.every(page => page.width === 210 && page.height === 297)) return;
  const { width, height } = pdfSheetGeometry(size);
  const css = doc.createElement('style');
  css.textContent = `
    @page { size: ${width}mm ${height}mm; margin: 0; }
    html, body { width: ${width}mm !important; min-width: ${width}mm !important; }
    .pdf-export-sheet { position: relative !important; box-sizing: border-box !important;
      width: ${width}mm !important; height: ${height}mm !important; margin: 0 !important;
      padding: 0 !important; overflow: hidden !important;
      break-inside: avoid !important; page-break-inside: avoid !important;
      print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
    .pdf-export-sheet > .pdf-export-page { position: absolute !important;
      left: var(--pdf-fit-left) !important; top: var(--pdf-fit-top) !important; right: auto !important; bottom: auto !important;
      transform: scale(var(--pdf-fit-scale)) !important; transform-origin: top left !important;
      break-after: auto !important; page-break-after: auto !important; }
  `;
  doc.head.appendChild(css);
  doc.querySelectorAll<HTMLElement>('.pdf-export-pages').forEach(container => {
    container.style.setProperty('width', `${width}mm`, 'important');
    container.style.setProperty('min-width', `${width}mm`, 'important');
  });
  pages.forEach((page, index) => {
    const source = dimensions[index];
    const fit = pdfSheetGeometry(size, source.height, source.width);
    page.style.setProperty('--pdf-fit-left', `${fit.left}mm`);
    page.style.setProperty('--pdf-fit-top', `${fit.top}mm`);
    page.style.setProperty('--pdf-fit-scale', String(fit.scale));
    const sheet = doc.createElement('div');
    sheet.className = 'pdf-export-sheet';
    sheet.dataset.paperSize = size;
    // Any aspect-ratio allowance should match dark/coloured paper too.
    sheet.style.backgroundColor = doc.defaultView?.getComputedStyle(page).backgroundColor ?? '#fff';
    sheet.style.setProperty('break-after', index === pages.length - 1 ? 'auto' : 'page', 'important');
    sheet.style.setProperty('page-break-after', index === pages.length - 1 ? 'auto' : 'always', 'important');
    page.before(sheet);
    sheet.appendChild(page);
    page.style.setProperty('box-sizing', 'border-box', 'important');
    page.style.setProperty('break-after', 'auto', 'important');
    page.style.setProperty('page-break-after', 'auto', 'important');
  });
}
