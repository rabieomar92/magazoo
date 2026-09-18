const PRINT_FRAME_CLASS = 'pdf-print-frame';
const RESOURCE_TIMEOUT_MS = 20_000;
// Preview's last scheduled overflow correction runs at 1,200 ms. Do not
// capture a transient pagination state between that correction and typing.
const PREVIEW_QUIET_MS = 1_300;

export function waitForStablePreview(source: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    let lastChange = performance.now();
    const started = lastChange;
    const observer = new MutationObserver(() => { lastChange = performance.now(); });
    const container = source.closest('.paper-scroll') ?? source;
    observer.observe(container, { subtree: true, childList: true, attributes: true, characterData: true });
    const timer = window.setInterval(() => {
      const now = performance.now();
      const finish = (error?: Error) => {
        window.clearInterval(timer);
        observer.disconnect();
        if (error) reject(error); else resolve();
      };
      if (!source.isConnected) return finish(new Error('The preview changed. Please retry PDF export.'));
      if (now - started > RESOURCE_TIMEOUT_MS) return finish(new Error('The preview is still updating. Wait for it to settle, then export again.'));
      if (container.getAttribute('data-preview-pending') === 'true' || document.fonts?.status === 'loading') {
        lastChange = now;
        return;
      }
      if (now - lastChange >= PREVIEW_QUIET_MS) finish();
    }, 100);
  });
}

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
    .pdf-export-pages {
      display: block !important;
    }
  }
  /* The contents spread measures itself against hidden twins of its own cards.
     They are laid out but never painted; the printed copy has no use for them
     at all, and dropping them keeps the PDF free of invisible duplicates. */
  .issue-mosaic-probe {
    display: none !important;
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

async function waitForFonts(target: Document) {
  const fonts = target.fonts;
  if (!fonts) return;
  await withTimeout(fonts.ready, 'Fonts took too long to load. Please retry PDF export.');
  // ready also resolves when a requested font failed, leaving fallback text
  // with different line lengths. Do not silently print that altered layout.
  if (Array.from(fonts).some(font => font.status === 'error')) {
    throw new Error('A publication font could not load. Reload the page and retry PDF export.');
  }
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
  // Offscreen frames can have animation callbacks suspended on mobile.
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 100);
    targetWindow.requestAnimationFrame(() => { window.clearTimeout(timer); resolve(); });
  });
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
          new Promise<void>((resolve, reject) => {
            if (link.sheet) {
              resolve();
              return;
            }
            link.addEventListener('load', () => resolve(), { once: true });
            link.addEventListener('error', () => reject(new Error('A stylesheet could not load. Please retry PDF export.')), { once: true });
          }),
      ),
    ).then(() => undefined),
    'Styles took too long to prepare for PDF export.',
  );
}

function freezeColumnLayout(source: HTMLElement, clone: HTMLElement) {
  // Remove only the preview zoom synchronously for precise layout reads. A
  // computed-style number can itself be rounded (344.90625 -> "344.906px"),
  // enough to drop a line at an exact column boundary. Restore before paint.
  const transform = source.style.getPropertyValue('transform');
  const priority = source.style.getPropertyPriority('transform');
  source.style.setProperty('transform', 'none', 'important');
  try {
    const sourceNodes = Array.from(source.querySelectorAll<HTMLElement>('*'));
    const cloneNodes = Array.from(clone.querySelectorAll<HTMLElement>('*'));
    sourceNodes.forEach((sourceNode, index) => {
      const cloneNode = cloneNodes[index];
      if (!cloneNode) return;
      const computed = window.getComputedStyle(sourceNode);
      const columnCount = Number.parseInt(computed.columnCount, 10);
      if (!Number.isFinite(columnCount) || columnCount <= 1 || sourceNode.offsetHeight <= 0) return;
      // Auto-height balanced bands must keep their original CSS. Replacing
      // their auto height with its measured result changes print's balancing
      // algorithm and can create a clipped third column, even when the screen
      // and print-media DOM rectangles appear identical before pagination.
      if (computed.columnFill === 'balance' || computed.columnFill === 'balance-all') return;

      // Author transforms remain in the clone. Avoid baking a scaled or
      // rotated ancestor's bounding box into the column dimensions as well.
      for (let ancestor: HTMLElement | null = sourceNode; ancestor && ancestor !== source; ancestor = ancestor.parentElement) {
        const transform = window.getComputedStyle(ancestor).transform;
        if (transform && transform !== 'none') return;
      }
      const rect = sourceNode.getBoundingClientRect();
      // Border-box DOMRect values retain the browser's full layout precision.
      // Computed strings are only a fallback for non-layout test environments.
      const precise = rect.width > 0 && rect.height > 0;
      cloneNode.style.setProperty('box-sizing', precise ? 'border-box' : computed.boxSizing, 'important');
      cloneNode.style.setProperty('height', precise ? `${rect.height}px` : computed.height, 'important');
      cloneNode.style.setProperty('width', precise ? `${rect.width}px` : computed.width, 'important');
      cloneNode.style.setProperty('column-count', String(columnCount), 'important');
      cloneNode.style.setProperty('column-gap', computed.columnGap, 'important');
      cloneNode.style.setProperty('column-fill', computed.columnFill, 'important');
    });
  } finally {
    if (transform) source.style.setProperty('transform', transform, priority);
    else source.style.removeProperty('transform');
  }
}

/**
 * `freezeColumns` bakes each multi-column box's measured geometry into the
 * clone. Print needs it: the print engine re-runs column balancing against a
 * different medium and can drop or clip a column otherwise. A clone that stays
 * on screen must NOT have it — a box whose width came from `40mm` laid out at
 * its full fractional precision, re-pinned to a rounded pixel measurement,
 * puts every glyph after it on a slightly different subpixel origin. The text
 * and the line breaks survive, so it reads as "almost right", which is exactly
 * how it looked beside the editor's own preview.
 */
export function clonePages(source: HTMLElement, targetDocument: Document, { freezeColumns = true } = {}) {
  const pages = source.cloneNode(true) as HTMLElement;
  pages.classList.remove('pages--spread');
  pages.classList.add('pdf-export-pages');
  pages.style.setProperty('display', 'block', 'important');
  pages.style.setProperty('width', '210mm', 'important');
  pages.style.setProperty('min-width', '210mm', 'important');
  pages.style.setProperty('transform', 'none', 'important');

  Array.from(pages.children).forEach((child, index) => {
    if (!(child instanceof HTMLElement)) return;
    if (!child.classList.contains('page')) return;
    child.classList.add('pdf-export-page');
    // Galleries need grid and front matter needs flex, not forced block layout.
    const original = source.children[index];
    if (original instanceof HTMLElement) child.style.setProperty('display', window.getComputedStyle(original).display, 'important');
    child.style.setProperty('width', '210mm', 'important');
    child.style.setProperty('height', '297mm', 'important');
    child.style.setProperty('margin', '0', 'important');
    child.style.setProperty('box-shadow', 'none', 'important');
  });

  if (freezeColumns) freezeColumnLayout(source, pages);

  // Structured templates carry hidden measuring sheets beside their visible
  // pages. Keep source/clone node indices matched until any geometry freeze is
  // done, then exclude those helpers from the cloned document completely.
  Array.from(pages.children).forEach(child => {
    if (!child.classList.contains('page')) child.remove();
  });

  targetDocument.body.appendChild(pages);
}

/** One article's sheets together with the element they inherit from. A sheet
 * cloned on its own loses everything its `.pages` wrapper contributes — the
 * RTL and drop-cap flags that scope descendant rules, and any custom property
 * the article's design set on that wrapper. Cloning the wrapper shallowly and
 * refilling it keeps all of that without copying computed styles onto the
 * sheet, which is what used to distort inherited line-height. */
export interface PageGroup { owner: HTMLElement; sheets: HTMLElement[] }

/** Sheets in reading order. A physical sheet is a `.page` whose parent is a
 * `.pages` container; the hidden measuring twins inside `.measure-root` and
 * `.fm-measure` are `.page`-like but never sit directly in one, so they are
 * excluded here exactly as the single-document path excludes them. */
export function issuePageGroups(root: HTMLElement): PageGroup[] {
  const groups: PageGroup[] = [];
  for (const sheet of Array.from(root.querySelectorAll<HTMLElement>('.page'))) {
    const owner = sheet.parentElement;
    if (!owner || !(owner === root || owner.classList.contains('pages'))) continue;
    const last = groups[groups.length - 1];
    if (last && last.owner === owner) last.sheets.push(sheet);
    else groups.push({ owner, sheets: [sheet] });
  }
  return groups;
}

/**
 * Every `.pages` container in the compiled issue, in reading order.
 *
 * One per article plus the contents spread — the same element the editor hands
 * `exportPreviewPdf` when you print that article on its own.
 */
export function issuePageContainers(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.pages'))
    .filter(container => Array.from(container.children).some(
      child => child instanceof HTMLElement && child.classList.contains('page'),
    ));
}

/**
 * Print each article exactly the way the article's own editor prints it.
 *
 * This is the whole point of the issue export: it runs `clonePages` — the
 * single-article function, with the single-article settings — once per article
 * against that article's own live preview, and appends the results into one
 * print document. There is no issue-specific cloning path that could drift
 * from the single-article one, because there is no issue-specific cloning
 * path. Printing the issue is printing each article, in order, in one job.
 */
export function cloneIssuePages(containers: readonly HTMLElement[], targetDocument: Document) {
  for (const container of containers) clonePages(container, targetDocument);
}

/**
 * Print a compiled issue: each article printed the way its own editor prints
 * it, concatenated into a single job. `clonePages` is called once per article
 * against that article's live preview with the same settings the single-article
 * export uses, so an article's pages in the issue PDF and the same article's
 * own PDF come out of identical code reading identical DOM.
 */
export async function exportIssuePdf(title: string, root: HTMLElement) {
  await waitForPreviewResources(root);
  const containers = issuePageContainers(root);
  const sheets = containers.flatMap(container => Array.from(container.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('page'),
  ));
  if (!sheets.length) throw new Error('The issue preview is not ready yet.');

  const restoreCounters = sheets.map(resolveReferenceCounters);
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
    if (!printDocument || !printWindow) throw new Error('The browser could not create a PDF document.');

    printDocument.open();
    printDocument.write('<!doctype html><html><head></head><body></body></html>');
    printDocument.close();
    printDocument.title = `${safeFileStem(title)} - Magazoo`;
    copyAuthorStyles(document, printDocument);

    const exportCss = printDocument.createElement('style');
    exportCss.textContent = PDF_EXPORT_CSS;
    printDocument.head.appendChild(exportCss);

    // The proof pane carries a zoom, and column geometry has to be frozen from
    // the unscaled layout. Restored as soon as the clone is taken, so the pane
    // never flashes at full size behind the print dialog.
    const transform = root.style.getPropertyValue('transform');
    const priority = root.style.getPropertyPriority('transform');
    root.style.setProperty('transform', 'none', 'important');
    try { cloneIssuePages(containers, printDocument); }
    finally {
      if (transform) root.style.setProperty('transform', transform, priority);
      else root.style.removeProperty('transform');
    }

    // Each article keeps its own container, so the stylesheet's per-container
    // :last-child rule would let the next article share a sheet. Numbering the
    // breaks across the whole issue is the only thing that spans containers.
    const printed = Array.from(printDocument.querySelectorAll<HTMLElement>('.pdf-export-page'));
    printed.forEach((sheet, index) => {
      const last = index === printed.length - 1;
      sheet.style.setProperty('break-after', last ? 'auto' : 'page', 'important');
      sheet.style.setProperty('page-break-after', last ? 'auto' : 'always', 'important');
    });

    await waitForStyles(printDocument);
    await waitForFonts(printDocument);
    await Promise.all(Array.from(printDocument.images).map(waitForImage));
    await nextPaint(printWindow);
    await nextPaint(printWindow);

    let removed = false;
    const cleanup = () => { if (removed) return; removed = true; frame?.remove(); };
    printWindow.addEventListener('afterprint', cleanup, { once: true });
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    frame?.remove();
    throw error;
  } finally {
    restoreCounters.forEach(restore => restore());
  }
}

/**
 * Print the committed preview DOM directly. The browser still owns PDF
 * generation, but it receives real HTML/CSS rather than a bitmap snapshot.
 * That keeps the preview's measured pagination while retaining selectable,
 * searchable, resolution-independent text in the exported PDF.
 */
export async function waitForPreviewResources(source: HTMLElement) {
  await waitForFonts(document);
  await Promise.all([
    ...Array.from(source.querySelectorAll<HTMLImageElement>('img')).map(waitForImage),
    ...backgroundImageUrls(source).map(waitForBackgroundImage),
  ]);
  await nextPaint();
  await nextPaint();
  await waitForStablePreview(source);
}

export async function exportPreviewPdf(title: string, suppliedSource?: HTMLElement) {
  const source = suppliedSource ?? document.querySelector<HTMLElement>('.pages');
  if (!source) throw new Error('The page preview is not ready yet.');

  await waitForPreviewResources(source);
  // Pagination can replace sheets while images/fonts are loading. Resolve
  // counters and clone only the sheets from the settled render.
  const pages = Array.from(source.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('page'),
  );
  if (!pages.length) throw new Error('The page preview is not ready yet.');

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
    await waitForFonts(printDocument);
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
    // Keep the document alive until the print UI closes. Mobile print/share
    // dialogs may stay open for minutes; a timer must not erase their source.
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    frame?.remove();
    throw error;
  } finally {
    restoreCounters.forEach((restore) => restore());
  }
}
