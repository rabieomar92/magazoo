import { PAGE_H, PAGE_W } from './geometry';
import { framedAxis, normalizeImageFrame, type ImageFrame } from './imageFrame';

/**
 * magazine-2 ("Particle Feature") runs a single photo across two sheets: a strip
 * down the right edge of sheet 1, then the whole of sheet 2. There is only ever
 * ONE asset — each sheet paints a different window into it, so the halves meet
 * exactly at the fold and the spread reads like an open book.
 *
 * The window is a plain background-position offset, computed here in mm so the
 * same numbers hold at any preview zoom and in the printed PDF (no % of a box
 * whose width differs per sheet, no two images to keep in sync).
 */

/** Width of the photo strip on sheet 1, mm. The single source: cssVars-style
 *  callers publish it as --mag2-strip, so the CSS never repeats the number. */
export const MAG2_STRIP = 45;

export interface SplitPhoto {
  /** Painted photo size, mm — 'cover' over the strip+sheet region, computed. */
  w: number;
  h: number;
  /** Top-left of the photo relative to the region's top-left (≤ 0), mm. */
  x: number;
  y: number;
}

export type PhotoFrame = ImageFrame;

export function framedSpreadPhoto(
  ar: number,
  regionW: number,
  regionH: number,
  frame?: Partial<PhotoFrame>,
): SplitPhoto {
  const safeAr = Number.isFinite(ar) && ar > 0 ? ar : 16 / 9;
  const { scale, offsetX, offsetY } = normalizeImageFrame(frame);
  const baseW = Math.max(regionW, regionH * safeAr);
  const baseH = baseW / safeAr;
  const w = baseW * scale;
  const h = baseH * scale;
  return {
    w,
    h,
    x: framedAxis(regionW, w, offsetX),
    y: framedAxis(regionH, h, offsetY),
  };
}

/**
 * Cover-fit `ar` (width/height) over the region: strip + one full sheet wide,
 * one sheet tall. The photo is centred, so both sheets crop symmetrically.
 */
export function splitPhoto(
  ar: number,
  frame?: Partial<PhotoFrame>,
  strip = MAG2_STRIP,
): SplitPhoto {
  const regionW = strip + PAGE_W;
  return framedSpreadPhoto(ar, regionW, PAGE_H, frame);
}

/** Background shorthand values for sheet 1's strip (region starts at its left edge). */
export const stripBg = (p: SplitPhoto) => ({
  backgroundSize: `${p.w}mm ${p.h}mm`,
  backgroundPosition: `${p.x}mm ${p.y}mm`,
});

/** Sheet 2 starts `strip` further into the region, so the window shifts left. */
export const photoPageBg = (p: SplitPhoto, strip = MAG2_STRIP) => ({
  backgroundSize: `${p.w}mm ${p.h}mm`,
  backgroundPosition: `${p.x - strip}mm ${p.y}mm`,
});

/** Equal A4 halves of a conventional two-sheet gatefold. */
export const gatePageBg = (p: SplitPhoto, pageIndex: 0 | 1) => ({
  backgroundSize: `${p.w}mm ${p.h}mm`,
  backgroundPosition: `${p.x - pageIndex * PAGE_W}mm ${p.y}mm`,
});
