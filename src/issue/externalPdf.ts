import type { ExternalIssuePdf } from './model';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;
const cache = new WeakMap<ExternalIssuePdf, Promise<string[]>>();
const activeUrls = new WeakMap<ExternalIssuePdf, string[]>();
const cancelled = new WeakSet<ExternalIssuePdf>();

async function openPdf(src: string) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const base = `${import.meta.env.BASE_URL}pdfjs/`;
  // Decode the self-contained backup locally. Fetching a data: URL is blocked
  // by the production connect-src policy, even though image previews allow it.
  const encoded = src.slice(src.indexOf(',') + 1);
  const data = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const task = pdfjs.getDocument({ data,
    cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/` });
  task.onPassword = () => { void task.destroy(); };
  const pdf = await task.promise.catch(error => {
    if (/worker|module script|dynamically imported module/i.test(error?.message ?? '')) {
      throw new Error('The PDF reader could not load. This is a website loading problem, not a damaged PDF. Refresh the page; if it continues, contact the administrator.');
    }
    throw new Error(error?.name === 'PasswordException' || error?.message?.includes('destroyed') ? 'Unlock this PDF before importing it.' : 'This PDF could not be opened. Try saving a new copy.');
  });
  return { pdf, close: () => task.destroy() };
}

async function renderPage(pdf: PDFDocumentProxy, index: number, dpi: number) {
  const page = await pdf.getPage(index);
  const natural = page.getViewport({ scale: 1 });
  // 300 dpi on normal publication pages; cap unusual oversized artwork.
  const scale = Math.min(dpi / 72, Math.sqrt(12_000_000 / (natural.width * natural.height)));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  try {
    await page.render({ canvas, viewport, background: 'rgb(255,255,255)' }).promise;
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not render the PDF page.')), 'image/png'));
  } finally { canvas.width = canvas.height = 0; page.cleanup(); }
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the PDF.')); reader.readAsDataURL(blob);
  });
}

export async function importIssuePdf(file: File): Promise<ExternalIssuePdf> {
  if (file.size > MAX_PDF_BYTES) throw new Error('Choose a PDF smaller than 8 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Choose a valid PDF file.');
  const src = await dataUrl(new Blob([bytes], {type:'application/pdf'}));
  const { pdf, close } = await openPdf(src);
  try {
    if (pdf.numPages < 1 || pdf.numPages > MAX_PDF_PAGES) throw new Error('Import up to 20 pages per PDF. Split larger files first.');
    const thumbnail = await dataUrl(await renderPage(pdf, 1, 36));
    return { id: `pdf-${crypto.randomUUID()}`, name: file.name.slice(0, 200), src, pageCount: pdf.numPages, thumbnail };
  } finally { await close(); }
}

export function renderIssuePdf(pdf: ExternalIssuePdf): Promise<string[]> {
  const existing = cache.get(pdf); if (existing) return existing;
  cancelled.delete(pdf);
  const urls: string[] = []; activeUrls.set(pdf, urls);
  const work = (async () => {
    const { pdf: source, close } = await openPdf(pdf.src);
    try {
      if (source.numPages !== pdf.pageCount) throw new Error('The imported PDF page count changed. Remove it and import it again.');
      for (let index=1; index<=source.numPages; index++) {
        const blob=await renderPage(source,index,300);
        if(cancelled.has(pdf))throw new Error('PDF preparation was cancelled.');
        urls.push(URL.createObjectURL(blob));
      }
      return urls;
    } catch (error) { releaseIssuePdf(pdf); throw error; }
    finally { await close(); }
  })();
  cache.set(pdf, work); return work;
}

export function releaseIssuePdf(pdf: ExternalIssuePdf) {
  cancelled.add(pdf);
  activeUrls.get(pdf)?.forEach(url => URL.revokeObjectURL(url));
  activeUrls.delete(pdf); cache.delete(pdf);
}
