/** ISO sizes. Keep the measured A4 artwork intact; fit it onto the output sheet. */
export type PdfPageSize = 'a4' | 'b5';
export const PDF_PAGE_SIZES = {
  a4: { label: 'A4', width: 210, height: 297 },
  b5: { label: 'B5 (ISO)', width: 176, height: 250 },
} as const;

export function pdfSheetGeometry(size: PdfPageSize, sourceHeight = 297) {
  const { width, height } = PDF_PAGE_SIZES[size];
  const scale = Math.min(width / 210, height / sourceHeight);
  return { width, height, scale, left: (width - 210 * scale) / 2, top: (height - sourceHeight * scale) / 2 };
}

/** Called only on the print clone, after author styles have loaded. Never
 * change editor geometry, pagination, source images, or the compiled proof. */
export function fitPdfSheets(doc: Document, size: PdfPageSize) {
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('.pdf-export-page'));
  if (size === 'a4' && pages.every(page => page.dataset.pageHeightMm !== '276')) return;
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
    const fit = pdfSheetGeometry(size, page.dataset.pageHeightMm === '276' ? 276 : 297);
    page.style.setProperty('--pdf-fit-left', `${fit.left}mm`);
    page.style.setProperty('--pdf-fit-top', `${fit.top}mm`);
    page.style.setProperty('--pdf-fit-scale', String(fit.scale));
    const sheet = doc.createElement('div');
    sheet.className = 'pdf-export-sheet';
    sheet.dataset.paperSize = size;
    // The tiny aspect-ratio allowance should match dark/coloured paper too.
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
