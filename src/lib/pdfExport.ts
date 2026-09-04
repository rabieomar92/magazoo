const PRINT_FRAME_CLASS = 'pdf-print-frame';

function safeFileStem(title: string) {
  const printableTitle = Array.from(title, (character) =>
    character.charCodeAt(0) < 32 ? ' ' : character,
  ).join('');
  return (
    printableTitle
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 120) || 'Magazoo publication'
  );
}

function waitForImage(image: HTMLImageElement) {
  if (image.complete) return image.decode?.().catch(() => undefined) ?? Promise.resolve();
  return new Promise<void>((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
  });
}

/**
 * Print a clean document made only from the committed A4 sheets. Printing the
 * application shell itself lets browser flex/overflow containers participate
 * in fragmentation, which can create a blank first sheet and clipped later
 * sheets. The isolated frame has one direct page box per PDF page and no UI.
 */
export async function exportPreviewPdf(title: string) {
  const source = document.querySelector<HTMLElement>('.pages');
  if (!source || !source.querySelector('.page')) {
    throw new Error('The page preview is not ready yet.');
  }

  document.querySelector(`.${PRINT_FRAME_CLASS}`)?.remove();
  const frame = document.createElement('iframe');
  frame.className = PRINT_FRAME_CLASS;
  frame.title = 'PDF export';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const printDocument = frame.contentDocument;
  const printWindow = frame.contentWindow;
  if (!printDocument || !printWindow) {
    frame.remove();
    throw new Error('The browser could not create a PDF document.');
  }

  printDocument.open();
  printDocument.write('<!doctype html><html><head></head><body></body></html>');
  printDocument.close();
  printDocument.title = `${safeFileStem(title)} – Magazoo`;

  const base = printDocument.createElement('base');
  base.href = document.baseURI;
  printDocument.head.appendChild(base);

  // Carry every loaded app stylesheet (including bundled fonts and KaTeX)
  // into the isolated document. DOM import avoids serialising user content.
  for (const node of Array.from(document.head.children)) {
    if (node instanceof HTMLStyleElement || (node instanceof HTMLLinkElement && node.rel === 'stylesheet')) {
      printDocument.head.appendChild(printDocument.importNode(node, true));
    }
  }
  const authoredCss = document.querySelector<HTMLStyleElement>('.paper-scroll > style');
  if (authoredCss) printDocument.head.appendChild(printDocument.importNode(authoredCss, true));

  const exportCss = printDocument.createElement('style');
  exportCss.textContent = `
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0 !important; padding: 0 !important; width: 210mm; background: #fff; }
    body { overflow: visible !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .pdf-pages { display: block !important; width: 210mm !important; transform: none !important; }
    .pdf-pages > .page {
      display: block !important;
      width: 210mm !important;
      height: 297mm !important;
      margin: 0 !important;
      box-shadow: none !important;
      overflow: hidden !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      break-after: page !important;
      page-break-after: always !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .pdf-pages > .page + .page {
      break-before: auto !important;
      page-break-before: auto !important;
    }
    .pdf-pages > .page:last-child {
      break-after: auto !important;
      page-break-after: auto !important;
    }
    .placed-image, .placed-image:active { box-shadow: none !important; }
  `;
  printDocument.head.appendChild(exportCss);

  const pages = printDocument.importNode(source, true) as HTMLElement;
  pages.classList.remove('pages--spread');
  pages.classList.add('pdf-pages');
  pages.style.removeProperty('transform');
  printDocument.body.appendChild(pages);

  await Promise.all([
    printDocument.fonts?.ready ?? Promise.resolve(),
    ...Array.from(printDocument.images).map(waitForImage),
  ]);
  await new Promise<void>((resolve) => printWindow.requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => printWindow.requestAnimationFrame(() => resolve()));

  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    frame.remove();
  };
  printWindow.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 120_000);
  printWindow.focus();
  printWindow.print();
}
