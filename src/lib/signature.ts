import type { Asset, FrontMatter } from '../schema/document';

export type SignatureCrop = NonNullable<FrontMatter['signatureCrop']>;
const fullImage: SignatureCrop = { x: 0, y: 0, width: 1, height: 1 };
const bounded = (n: number | undefined, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n! : fallback));

export function normalizeSignatureCrop(crop?: SignatureCrop): SignatureCrop {
  if (!crop || ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || crop.width <= 0 || crop.height <= 0) return { ...fullImage };
  const x = bounded(crop.x, 0, 0, .999);
  const y = bounded(crop.y, 0, 0, .999);
  return { x, y, width: bounded(crop.width, 1, .001, 1 - x), height: bounded(crop.height, 1, .001, 1 - y) };
}

/** Shared by the controls and printed page: size is a physical width, never
 * a zoom level inside a different-sized crop box. */
export function signatureGeometry(asset: Asset | null | undefined, content: Partial<FrontMatter>, pageMargin = 14) {
  const crop = normalizeSignatureCrop(content.signatureCrop);
  const sourceWidth = asset && Number.isFinite(asset.naturalWidth) && asset.naturalWidth > 0 ? asset.naturalWidth : 3;
  const sourceHeight = asset && Number.isFinite(asset.naturalHeight) && asset.naturalHeight > 0 ? asset.naturalHeight : 1;
  const aspect = sourceWidth * crop.width / (sourceHeight * crop.height);
  // Dean's fixed rail (35), rail gap (7) and column gap (6), all in mm.
  const columnWidth = Math.max(10, (210 - 2 * bounded(pageMargin, 14, 0, 80) - 48) / 2);
  const requestedWidth = bounded(content.signatureWidth, 34, 10, 80);
  // Tall scans must not consume a column. The editor reports the actual size
  // and offers a margin trim instead of stretching or silently cropping them.
  const width = Math.min(requestedWidth, columnWidth, 55 * aspect);
  const align: 'start' | 'center' | 'end' = content.signatureAlign === 'center' || content.signatureAlign === 'end' ? content.signatureAlign : 'start';
  return { crop, aspect, width, height: width / aspect, requestedWidth, columnWidth,
    gap: bounded(content.signatureGap, 2, 0, 20),
    align,
  };
}

/** Find non-white/non-transparent ink; return a padded, reversible viewport. */
export function signatureInkBounds(data: Uint8ClampedArray, width: number, height: number): SignatureCrop | null {
  if (width < 1 || height < 1 || data.length < width * height * 4) return null;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const alpha = data[i + 3] / 255;
    if (alpha * (255 - Math.min(data[i], data[i + 1], data[i + 2])) < 24) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left) return null;
  const pad = Math.max(2, Math.ceil(Math.min(width, height) * .015));
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(width, right + 1 + pad); bottom = Math.min(height, bottom + 1 + pad);
  return { x: left / width, y: top / height, width: (right - left) / width, height: (bottom - top) / height };
}

export async function detectSignatureCrop(src: string): Promise<SignatureCrop | null> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image analysis is unavailable.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return signatureInkBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}
