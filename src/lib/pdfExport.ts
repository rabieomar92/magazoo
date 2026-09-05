import { getFontEmbedCSS, toBlob } from 'html-to-image';

const PRINT_FRAME_CLASS = 'pdf-print-frame';
const RESOURCE_TIMEOUT_MS = 20_000;

/** 3 CSS pixels per exported pixel gives an A4 page roughly 288 dpi. More
 * importantly, the page is rasterised while it is still in screen media, so
 * Chromium cannot substitute a print font and move words between columns. */
export const PDF_CAPTURE_PIXEL_RATIO = 3;

/** The print document contains only immutable page snapshots. The editor has
 * already performed typography, pagination, image wrapping, and topbar layout;
 * print is responsible only for placing each snapshot on one portrait A4 page. */
export const PDF_EXPORT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm;
    min-width: 210mm;
    background: #fff;
  }
  body {
    overflow: visible !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .pdf-page-snapshot {
    display: block;
    box-sizing: border-box;
    width: 210mm !important;
    height: 297mm !important;
    margin: 0 !important;
    object-fit: fill;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    break-after: page !important;
    page-break-after: always !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .pdf-page-snapshot:last-child {
    break-after: auto !important;
    page-break-after: auto !important;
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

/** Extract URL resources from a computed CSS image value. This covers split
 * magazine photos and page artwork, which are backgrounds rather than <img>
 * elements and therefore are not included in HTMLImageElement collections. */
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

async function capturePage(page: HTMLElement, fontEmbedCSS: string) {
  if (!page.offsetWidth || !page.offsetHeight) {
    throw new Error('A preview page has no printable size.');
  }

  const blob = await withTimeout(
    toBlob(page, {
      pixelRatio: PDF_CAPTURE_PIXEL_RATIO,
      preferredFontFormat: 'woff2',
      fontEmbedCSS,
      cacheBust: false,
      backgroundColor: window.getComputedStyle(page).backgroundColor || '#fff',
      style: {
        margin: '0',
        boxShadow: 'none',
        transform: 'none',
      },
    }),
    'A page took too long to capture for PDF export.',
  );
  if (!blob) throw new Error('The browser could not capture a preview page.');
  return blob;
}

/**
 * Export the committed editor pages without asking Chromium to lay them out a
 * second time. Print mode may substitute a protected/local font (notably
 * Avenir Next), and a tiny glyph-width change is enough to move the last line
 * into the following column. Capturing the live screen-rendered `.page` nodes
 * first freezes every approved line break, column boundary, image wrap, and
 * topbar position. The isolated print frame then contains only one immutable
 * high-resolution image per A4 sheet.
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

  // Embed the app's webfonts once and reuse the result for every page. Local
  // system faces are rasterised now, before the print engine can replace them.
  const fontEmbedCSS = await withTimeout(
    getFontEmbedCSS(source),
    'Fonts took too long to prepare for PDF export.',
  );

  const objectUrls: string[] = [];
  let frame: HTMLIFrameElement | null = null;
  try {
    for (const page of pages) {
      const blob = await capturePage(page, fontEmbedCSS);
      objectUrls.push(URL.createObjectURL(blob));
    }

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

    const exportCss = printDocument.createElement('style');
    exportCss.textContent = PDF_EXPORT_CSS;
    printDocument.head.appendChild(exportCss);

    for (const objectUrl of objectUrls) {
      const image = printDocument.createElement('img');
      image.className = 'pdf-page-snapshot';
      image.alt = '';
      image.src = objectUrl;
      printDocument.body.appendChild(image);
    }
    await Promise.all(Array.from(printDocument.images).map(waitForImage));
    await nextPaint(printWindow);
    await nextPaint(printWindow);

    let removed = false;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      frame?.remove();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    printWindow.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(cleanup, 120_000);
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    frame?.remove();
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }
}
