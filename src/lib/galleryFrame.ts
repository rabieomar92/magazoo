import { framedAxis, normalizeImageFrame, type ImageFrame } from './imageFrame';

export type GalleryFrame = ImageFrame;

export interface GalleryFrameGeometry {
  width: number;
  height: number;
  /** Position in percent of one viewport/cell. */
  left: number;
  top: number;
  objectX: number;
  objectY: number;
  objectFit: 'cover' | 'contain';
}

/**
 * Place one gallery image over one or two equal-width viewports. Legacy crop
 * focus stays bounded; explicit free pan may reveal the sheet. `spanX = 2` is
 * the logical centre-fold canvas. Both
 * rendered halves receive the same global geometry; the right half merely
 * subtracts one viewport width from `left`, so their pixels always meet at the
 * fold after zooming or panning.
 */
export function galleryFrameGeometry(
  frame: GalleryFrame | undefined,
  spanX: 1 | 2 = 1,
): GalleryFrameGeometry {
  const { scale, offsetX, offsetY, panX=0, panY=0 } = normalizeImageFrame(frame);
  const width = spanX * 100 * scale;
  const height = 100 * scale;

  return {
    width,
    height,
    // Keep old bounded focus, then translate freely in logical frame units.
    left: framedAxis(spanX * 100, width, offsetX) + spanX * panX,
    top: framedAxis(100, height, offsetY) + panY,
    objectX: 50 - offsetX,
    objectY: 50 - offsetY,
    objectFit: scale < 1 ? 'contain' : 'cover',
  };
}
