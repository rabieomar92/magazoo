import { create } from 'zustand';
import type { PdfPageSize } from '../lib/pdfPageSize';

const KEY = 'magazoo.pdf-page-size';
const isSize = (value: unknown): value is PdfPageSize => value === 'a4' || value === 'b5' || value === 'jis-b5' || value === 'vendor-b5' || value === 'magazine';
function savedSize(): PdfPageSize {
  try { const value = localStorage.getItem(KEY); return isSize(value) ? value : 'a4'; }
  catch { return 'a4'; }
}

/** Browser preference only: independent of articles, autosave and the database. */
export const usePdfPreferences = create<{ size: PdfPageSize; setSize: (size: PdfPageSize) => void }>(set => ({
  size: savedSize(),
  setSize: size => {
    if (!isSize(size)) return;
    try { localStorage.setItem(KEY, size); } catch { /* Private browsing may disable storage. */ }
    set({ size });
  },
}));

export function usePdfPageSize() {
  const size = usePdfPreferences(state => state.size);
  const setSize = usePdfPreferences(state => state.setSize);
  return [size, setSize] as const;
}
