import type { Doc } from '../schema/document';
import { ALL_FONTS } from './fonts';
import { PAGE_H } from './geometry';

export const MAX_MARGIN_TEXT_BOTTOM_OFFSET = PAGE_H;

function bounded(value: number | undefined, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

/** Defaults are read-time only: old documents remain visually unchanged. */
export function marginTextSettings(doc: Doc) {
  const raw = doc.marginText;
  return {
    enabled: raw?.enabled === true,
    mode: raw?.mode === 'all' ? 'all' as const : 'per-page' as const,
    side: raw?.side === 'right' ? 'right' as const : 'left' as const,
    edgeOffset: bounded(raw?.edgeOffset, 6, 2, 30),
    bottomOffset: bounded(raw?.bottomOffset, 20, 0, MAX_MARGIN_TEXT_BOTTOM_OFFSET),
    fontFamily: ALL_FONTS.includes(raw?.fontFamily ?? '') ? raw!.fontFamily! : 'Helvetica',
    fontSize: bounded(raw?.fontSize, 6.5, 5, 12),
    color: typeof raw?.color === 'string' && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(raw.color) ? raw.color : undefined,
  };
}

export function pageMarginText(doc: Doc, index: number): string {
  const settings = marginTextSettings(doc);
  if (!settings.enabled || !Number.isInteger(index) || index < 0) return '';
  const text = settings.mode === 'all' ? doc.marginText?.text : doc.marginText?.pages?.[String(index + 1)];
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}
