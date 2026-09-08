import type { Doc } from '../schema/document';
import { barStartsRight } from './barSide';
import { imagePalette } from './imagePalette';
import { ALL_FONTS } from './fonts';

export const DEFAULT_FOOTER_BOTTOM_OFFSET = 8;
export const MAX_FOOTER_BOTTOM_OFFSET = 40;
export const DEFAULT_FOOTER_FONT_SIZE = 7;
export const DEFAULT_FOOTER_FONT = 'Helvetica';

export function footerBottomOffset(doc: Doc): number {
  const value = doc.footer?.bottomOffset;
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_FOOTER_BOTTOM_OFFSET, value))
    : DEFAULT_FOOTER_BOTTOM_OFFSET;
}

/** Reserve the footer's 7pt line box, 2mm top padding and 1mm clearance.
 * Only the bottom margin changes; column widths and top positions stay put. */
export function footerBottomMargin(doc: Doc): number {
  const size = pageFooter(doc, 0).fontSize;
  return doc.templateId === 'magazine-4' || doc.footer?.enabled === false ? doc.design.margin
    : Math.max(doc.design.margin, footerBottomOffset(doc) + size * 25.4 / 72 + 3);
}

export function footerInk(background = '#ffffff') {
  const h = background.replace('#', '');
  const hex = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[\da-f]{6}$/i.test(hex)) return 'var(--paper-ink, #111)';
  return imagePalette([parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255])!.ink;
}

export function pageFooter(doc: Doc, index: number) {
  const raw = doc.footer?.startNumber ?? doc.frontMatter?.pageStart ?? 1;
  const start = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 1;
  return {
    enabled: doc.templateId !== 'magazine-4' && doc.footer?.enabled !== false,
    text: doc.footer?.text ?? doc.frontMatter?.contact ?? doc.meta.masthead ?? 'Magazoo!',
    number: start + index,
    right: barStartsRight(doc.design.barSide, index),
    fontFamily: ALL_FONTS.includes(doc.footer?.fontFamily ?? '') ? doc.footer!.fontFamily! : DEFAULT_FOOTER_FONT,
    fontSize: Number.isFinite(doc.footer?.fontSize) ? Math.max(5, Math.min(18, doc.footer!.fontSize!)) : DEFAULT_FOOTER_FONT_SIZE,
  };
}
