const PRINT_FRAME_CLASS = 'pdf-print-frame';
const RESOURCE_TIMEOUT_MS = 20_000;

/**
 * The PDF is produced by the browser's print engine from the actual page DOM.
 * Keeping text, vectors, CSS backgrounds, and images as DOM content means the
 * resulting PDF remains searchable and sharp at any zoom level.
 */
export const PDF_EXPORT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;
    min-width: 210mm !important;
    background: #fff !important;
  }
  body {
    overflow: visible !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .pdf-export-pages {
    display: block !important;
    width: 210mm !important;
    min-width: 210mm !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    transform-origin: top left !important;
  }
  .pdf-export-pages > .pdf-export-page {
    display: block !important;
    box-sizing: border-box !important;
    width: 210mm !important;
    height: 297mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    break-after: page !important;
    page-break-after: always !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .pdf-export-pages > .pdf-export-page:last-child {
    break-after: auto !important;
    page-break-after: auto !important;
  }
  @media print {
    .pdf-export-pages,
    .pdf-export-pages > .pdf-export-page {
      display: block !important;
    }
  }
`;

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

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), RESOURCE_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function waitForImage(image: HTMLImageElement) {
  const decode = () => image.decode?.().catch(() => undefined) ?? Promise.resolve();
  if (image.complete) {
    if (!image.naturalWidth) return Promise.reject(new Error('An image in the preview could not be loaded.'));
    return decode();
  }
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => void decode().then(resolve), { once: true });
      image.addEventListener('error', () => reject(new Error('An image in the preview could not be loaded.')), {
        once: true,
      });
    }),
    'An image took too long to prepare for PDF export.',
  );
}

/** Extract URL resources from author/template CSS backgrounds. */
export function cssImageUrls(value: string): string[] {
  const urls: string[] = [];
  const matcher = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/g;
  for (const match of value.matchAll(matcher)) {
    const url = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (url) urls.push(url);
  }
  return urls;
}

function backgroundImageUrls(root: HTMLElement): string[] {
  const urls = new Set<string>();
  for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    for (const pseudo of [null, '::before', '::after'] as const) {
      const value = window.getComputedStyle(element, pseudo).backgroundImage;
      for (const url of cssImageUrls(value)) urls.add(url);
    }
  }
  return [...urls];
}

function waitForBackgroundImage(url: string) {
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const image = document.createElement('img');
      const decode = () => image.decode?.().catch(() => undefined) ?? Promise.resolve();
      image.addEventListener('load', () => void decode().then(resolve), { once: true });
      image.addEventListener(
        'error',
        () => reject(new Error('A background image in the preview could not be loaded.')),
        { once: true },
      );
      image.src = url;
      if (image.complete && image.naturalWidth) void decode().then(resolve);
    }),
    'A background image took too long to prepare for PDF export.',
  );
}

function nextPaint(targetWindow: Window = window) {
  return new Promise<void>((resolve) => targetWindow.requestAnimationFrame(() => resolve()));
}

const REF_INDEX_ATTR = 'data-pdf-ref-index';

/** Resolve CSS counters before cloning the live pages into the print frame. */
function resolveReferenceCounters(page: HTMLElement): () => void {
  const lists = page.querySelectorAll<HTMLOListElement>('ol.references');
  if (!lists.length) return () => {};

  const touched: HTMLLIElement[] = [];
  lists.forEach((list) => {
    Array.from(list.children).forEach((child, index) => {
      if (!(child instanceof HTMLLIElement)) return;
      child.setAttribute(REF_INDEX_ATTR, String(index + 1));
      touched.push(child);
    });
  });

  const style = page.ownerDocument.createElement('style');
  style.textContent = `[${REF_INDEX_ATTR}]::before { content: attr(${REF_INDEX_ATTR}) '.' !important; }`;
  page.appendChild(style);

  return () => {
    style.remove();
    touched.forEach((li) => li.removeAttribute(REF_INDEX_ATTR));
  };
}

function copyAuthorStyles(sourceDocument: Document, targetDocument: Document) {
  const base = targetDocument.createElement('base');
  base.href = sourceDocument.baseURI;
  targetDocument.head.appendChild(base);

  // Hyphenation and several font/text shaping decisions depend on the
  // document language and direction. The print frame starts as a blank
  // document, so carry these root attributes across before it lays out any
  // cloned text.
  for (const attribute of ['lang', 'dir']) {
    const value = sourceDocument.documentElement.getAttribute(attribute);
    if (value) targetDocument.documentElement.setAttribute(attribute, value);
  }
  for (const attribute of ['class', 'dir']) {
    const value = sourceDocument.body?.getAttribute(attribute);
    if (value) targetDocument.body.setAttribute(attribute, value);
  }

  sourceDocument.head
    .querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]')
    .forEach((node) => targetDocument.head.appendChild(node.cloneNode(true)));

  // The editor keeps the user's custom CSS in the preview tree rather than in
  // <head>. It is part of the rendered page and must be present in the print
  // document too. Do not copy styles nested inside .pages: those belong to
  // preview-only counter fixes and are handled before cloning.
  const sourcePages = sourceDocument.querySelector('.pages');
  sourceDocument
    .querySelectorAll<HTMLStyleElement>('body style')
    .forEach((node) => {
      if (sourcePages?.contains(node)) return;
      targetDocument.head.appendChild(node.cloneNode(true));
    });
}

function waitForStyles(documentToWait: Document) {
  const links = Array.from(documentToWait.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  return withTimeout(
    Promise.all(
      links.map(
        (link) =>
          new Promise<void>((resolve) => {
            if (link.sheet) {
              resolve();
              return;
            }
            link.addEventListener('load', () => resolve(), { once: true });
            link.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    ).then(() => undefined),
    'Styles took too long to prepare for PDF export.',
  );
}

function freezeColumnLayout(source: HTMLElement, clone: HTMLElement) {
  const sourceNodes = Array.from(source.querySelectorAll<HTMLElement>('*'));
  const cloneNodes = Array.from(clone.querySelectorAll<HTMLElement>('*'));
  sourceNodes.forEach((sourceNode, index) => {
    const cloneNode = cloneNodes[index];
    if (!cloneNode) return;
    const computed = window.getComputedStyle(sourceNode);
    const columnCount = Number.parseInt(computed.columnCount, 10);
    if (!Number.isFinite(columnCount) || columnCount <= 1 || sourceNode.offsetHeight <= 0) return;
    const sourceRect = sourceNode.getBoundingClientRect();
    const scale = sourceNode.offsetWidth ? sourceRect.width / sourceNode.offsetWidth : 1;
    const sourceHeight = scale ? sourceRect.height / scale : sourceNode.offsetHeight;

    // Pin the measured multicolumn geometry from the committed preview. This
    // removes the print engine's opportunity to recalculate the column box
    // from a different page context while preserving the live text layout.
    cloneNode.style.setProperty('height', `${sourceHeight}px`, 'important');
    cloneNode.style.setProperty('width', `${sourceNode.offsetWidth}px`, 'important');
    cloneNode.style.setProperty('column-count', String(columnCount), 'important');
    cloneNode.style.setProperty('column-gap', computed.columnGap, 'important');
    cloneNode.style.setProperty('column-fill', computed.columnFill, 'important');
  });
}

export function clonePages(source: HTMLElement, targetDocument: Document) {
  const pages = source.cloneNode(true) as HTMLElement;
  pages.classList.remove('pages--spread');
  pages.classList.add('pdf-export-pages');
  pages.style.setProperty('display', 'block', 'important');
  pages.style.setProperty('width', '210mm', 'important');
  pages.style.setProperty('min-width', '210mm', 'important');
  pages.style.setProperty('transform', 'none', 'important');

  Array.from(pages.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (!child.classList.contains('page')) return;
    child.classList.add('pdf-export-page');
    child.style.setProperty('width', '210mm', 'important');
    child.style.setProperty('height', '297mm', 'important');
    child.style.setProperty('margin', '0', 'important');
    child.style.setProperty('box-shadow', 'none', 'important');
  });

  freezeColumnLayout(source, pages);

  // Structured templates carry hidden measuring sheets beside their visible
  // pages. Keep source/clone node indices matched until geometry is frozen,
  // then exclude those helpers from the printed document completely.
  Array.from(pages.children).forEach(child => {
    if (!child.classList.contains('page')) child.remove();
  });

  targetDocument.body.appendChild(pages);
}

/**
 * Print the committed preview DOM directly. The browser still owns PDF
 * generation, but it receives real HTML/CSS rather than a bitmap snapshot.
 * That keeps the preview's measured pagination while retaining selectable,
 * searchable, resolution-independent text in the exported PDF.
 */
export async function exportPreviewPdf(title: string) {
  const source = document.querySelector<HTMLElement>('.pages');
  const pages = source
    ? Array.from(source.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.classList.contains('page'),
      )
    : [];
  if (!source || !pages.length) throw new Error('The page preview is not ready yet.');

  await (document.fonts?.ready ?? Promise.resolve());
  await Promise.all([
    ...Array.from(source.querySelectorAll<HTMLImageElement>('img')).map(waitForImage),
    ...backgroundImageUrls(source).map(waitForBackgroundImage),
  ]);
  await nextPaint();
  await nextPaint();

  const restoreCounters = pages.map(resolveReferenceCounters);
  let frame: HTMLIFrameElement | null = null;
  try {
    document.querySelector(`.${PRINT_FRAME_CLASS}`)?.remove();
    frame = document.createElement('iframe');
    frame.className = PRINT_FRAME_CLASS;
    frame.title = 'PDF export';
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);

    const printDocument = frame.contentDocument;
    const printWindow = frame.contentWindow;
    if (!printDocument || !printWindow) {
      throw new Error('The browser could not create a PDF document.');
    }

    printDocument.open();
    printDocument.write('<!doctype html><html><head></head><body></body></html>');
    printDocument.close();
    printDocument.title = `${safeFileStem(title)} - Magazoo`;
    copyAuthorStyles(document, printDocument);

    const exportCss = printDocument.createElement('style');
    exportCss.textContent = PDF_EXPORT_CSS;
    printDocument.head.appendChild(exportCss);
    clonePages(source, printDocument);

    await waitForStyles(printDocument);
    await (printDocument.fonts?.ready ?? Promise.resolve());
    await Promise.all(Array.from(printDocument.images).map(waitForImage));
    await nextPaint(printWindow);
    await nextPaint(printWindow);

    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      frame?.remove();
    };
    printWindow.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(cleanup, 120_000);
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    frame?.remove();
    throw error;
  } finally {
    restoreCounters.forEach((restore) => restore());
  }
}
