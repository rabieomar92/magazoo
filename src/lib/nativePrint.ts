import { cloneIssuePages, clonePages, issuePageContainers, pdfExportCss, resolveReferenceCounters } from './pdfExport';
import { fitPdfSheets, type PdfPageSize } from './pdfPageSize';

interface PublicationPrint {
  source: () => HTMLElement | null;
  size: PdfPageSize;
  issue?: boolean;
  bleedMm?: number;
  shortcut: () => void;
}

/** Ctrl/Command+P uses the asynchronous, resource-checked export. Browser-menu
 * Print gets the same page clones synchronously via beforeprint; if its source
 * is not ready, print a clear instruction instead of stale/clipped artwork. */
export function registerPublicationPrint({ source, size, issue = false, shortcut,bleedMm=0 }: PublicationPrint) {
  const roots: HTMLElement[] = [];
  let style: HTMLStyleElement | null = null;
  const cleanup = () => {
    roots.splice(0).forEach(root => root.remove());
    style?.remove();
    style = null;
  };
  const onBeforePrint = () => {
    cleanup();
    style = document.createElement('style');
    // Keep the live editor visible and unchanged on screen. Only static page
    // clones participate in native paged layout, never the app's zoom frames.
    style.textContent = `
      @media screen { [data-native-print-root] { display:none !important; } }
      @media print {
        ${pdfExportCss(size)}
        /* Keep the live measuring rigs laid out while excluding the editor
           from paged flow. display:none makes observers repaginate at zero
           width/height and can leave the canvas rearranged after cancellation. */
        body > :not([data-native-print-root]) { position:fixed !important; inset:0 auto auto 0 !important; width:${document.documentElement.clientWidth}px !important; visibility:hidden !important; pointer-events:none !important; }
        body > :not([data-native-print-root]) :is(.measure-root,.fm-measure) { display:block !important; }
        [data-native-print-root] { display:contents !important; }
        .native-print-notice { display:block !important; padding:20mm; font:14pt/1.5 sans-serif; }
      }`;
    const mark = (root: HTMLElement) => {
      root.dataset.nativePrintRoot = 'true';
      root.style.removeProperty('display');
      roots.push(root);
    };
    try {
      const current = source();
      if (!current || current.closest<HTMLElement>('.paper-scroll')?.dataset.previewPending === 'true'
        || current.querySelector('[data-preview-pending="true"],.page[data-layout-overflow="true"],[data-outline-editing="true"],[data-dragging="true"],[data-image-avoidance="unresolved"],[data-caption-unplaced="true"]')
        || document.fonts?.status === 'loading'
        || [...current.querySelectorAll('img')].some(image => !image.complete || !image.naturalWidth)) {
        throw new Error('The publication is still updating or has a layout warning. Close this dialog, wait for the canvas to settle and use Export PDF.');
      }
      const containers = issue ? issuePageContainers(current) : [current];
      // beforeprint is synchronous: it cannot wait for a composited PNG to
      // decode. Never silently bypass the prepared export's stable photo fade.
      if(containers.some(container=>container.querySelector('.article-hero--fade > img, .page--paper3 .hero:not(.hero--hidden) > img'))){
        throw new Error('This photograph needs its fade prepared before printing. Close this dialog and use Export PDF or Ctrl/Command+P.');
      }
      const sheets = containers.flatMap(container => [...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('page')));
      if (!sheets.length) throw new Error('Compile or open the publication, then use Export PDF.');
      const restore = sheets.map(resolveReferenceCounters);
      try {
        (issue ? cloneIssuePages(containers, document) : [clonePages(current, document)]).forEach(mark);
      } finally { restore.forEach(reset => reset()); }
      const printed = roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('.pdf-export-page')]);
      printed.forEach((sheet, index) => {
        sheet.style.setProperty('break-after', index === printed.length - 1 ? 'auto' : 'page', 'important');
        sheet.style.setProperty('page-break-after', index === printed.length - 1 ? 'auto' : 'always', 'important');
      });
      // Operate on the clones only; the selected trim must already match.
      const fitting = fitPdfSheets(document, size,bleedMm);
      if (fitting) {
        style.textContent += `@media print { ${fitting.textContent} }`;
        fitting.remove();
      }
    } catch (error) {
      roots.splice(0).forEach(root => root.remove());
      const notice = document.createElement('section');
      notice.className = 'native-print-notice';
      notice.textContent = error instanceof Error ? error.message : 'Close this dialog and use Export PDF to prepare the publication.';
      document.body.append(notice);
      mark(notice);
    }
    // Do not hide the live source until its column geometry has been read.
    document.head.append(style);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'p') return;
    event.preventDefault();
    if (!event.repeat) shortcut();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', cleanup);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', cleanup);
    cleanup();
  };
}
