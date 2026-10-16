import type { Design, Doc } from '../schema/document';
import { imagePalette } from './imagePalette';

export interface PhotoSamplePoint { x: number; y: number }
export interface PhotoSampleBounds { left: number; top: number; width: number; height: number }
export type PhotoBackgroundColour = NonNullable<ReturnType<typeof imagePalette>>;

/** Uploaded photographs are embedded in JSON. Deliberately do not fetch URLs
 * or decode SVG/XML just to read a colour from an imported document. */
export function canSamplePhotoSource(src: string): boolean {
  return typeof src === 'string' && /^data:image\/(?:png|jpe?g|webp|avif|gif|bmp)(?:;[^,]*)?,/i.test(src.trim());
}

/** Map the displayed, uncropped photo back to its source, excluding letterboxes. */
export function photoPointAt(
  clientX: number, clientY: number, bounds: PhotoSampleBounds,
  naturalWidth: number, naturalHeight: number,
): PhotoSamplePoint | null {
  if (![clientX, clientY, bounds.left, bounds.top, bounds.width, bounds.height, naturalWidth, naturalHeight].every(Number.isFinite)
    || bounds.width <= 0 || bounds.height <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return null;
  const scale = Math.min(bounds.width / naturalWidth, bounds.height / naturalHeight);
  const width = naturalWidth * scale, height = naturalHeight * scale;
  const x = clientX - bounds.left - (bounds.width - width) / 2;
  const y = clientY - bounds.top - (bounds.height - height) / 2;
  if (x < 0 || y < 0 || x > width || y > height) return null;
  return { x: Math.max(0, Math.min(1, x / width)), y: Math.max(0, Math.min(1, y / height)) };
}

/** A small neighbourhood smooths photograph noise without averaging in the
 * subject elsewhere in the picture. Transparent pixels are not page colours. */
export function photoBackgroundColour(pixels: ArrayLike<number>): PhotoBackgroundColour | null {
  const opaque: number[] = [];
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 250) continue;
    opaque.push(pixels[i], pixels[i + 1], pixels[i + 2], 255);
  }
  return imagePalette(opaque);
}

export function sampledPageDesign(design: Design, colour: PhotoBackgroundColour, templateId: Doc['templateId']): Design {
  return {
    ...design,
    paperBg: colour.background,
    imageTheme: false,
    // This is the solid-colour command, not a translucent photograph overlay.
    pageBackgroundAssetId: undefined,
    colors: {
      ...design.colors, hero: colour.background, ink: colour.ink, accent: colour.ink,
      // Paper 3's sidebar deliberately uses its own dark ink. Other callouts
      // inherit page ink, so retain the same contrasting background there.
      accentSoft: templateId === 'paper-3' ? colour.soft : colour.background,
    },
  };
}

export function backgroundPhotoChoices(doc: Doc): { value: string; label: string }[] {
  const roles = new Map<string, string>();
  const label = (id: string | null | undefined, name: string) => { if (id && !roles.has(id)) roles.set(id, name); };
  label(doc.hero.assetId, 'Hero image');
  label(doc.cover?.assetId, 'Cover image');
  label(doc.design.pageBackgroundAssetId, 'Current background image');
  doc.images?.forEach((image, index) => label(image.assetId, `Page image ${index + 1}`));
  doc.blocks.filter(block => block.type === 'figure').forEach((image, index) => label(image.assetId, `Gallery photo ${index + 1}`));
  doc.news?.stories.forEach((story, index) => label(story.assetId, `News photo ${index + 1}`));
  const roleOrder = [...roles.keys()];
  return Object.entries(doc.assets).filter(([, asset]) => asset && typeof asset.src === 'string').map(([id, asset], index) => ({
    value: id, label: `${roles.get(id) ?? `Image ${index + 1}`} · ${asset.naturalWidth} × ${asset.naturalHeight}`,
  })).sort((a, b) => (roleOrder.indexOf(a.value) < 0 ? Infinity : roleOrder.indexOf(a.value))
    - (roleOrder.indexOf(b.value) < 0 ? Infinity : roleOrder.indexOf(b.value)));
}
