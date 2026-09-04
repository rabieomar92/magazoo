import { framedAxis, normalizeImageFrame } from './imageFrame';

export interface GalleryFrame {
  scale: number;
  offsetX: number;
  offsetY: number;
}

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
 * Place one gallery image over one or two equal-width viewports without ever
 * exposing an empty edge. `spanX = 2` is the logical centre-fold canvas. Both
 * rendered halves receive the same global geometry; the right half merely
 * subtracts one viewport width from `left`, so their pixels always meet at the
 * fold after zooming or panning.
 */
export function galleryFrameGeometry(
  frame: GalleryFrame | undefined,
  spanX: 1 | 2 = 1,
): GalleryFrameGeometry {
  const { scale, offsetX, offsetY } = normalizeImageFrame(frame);
  const width = spanX * 100 * scale;
  const height = 100 * scale;

  return {
    width,
    height,
    // The shared bounded-axis rule prevents accidental gaps at 1× and above.
    // Below 1×, the smaller contained bitmap can move only through free space.
    left: framedAxis(spanX * 100, width, offsetX),
    top: framedAxis(100, height, offsetY),
    objectX: 50 - offsetX,
    objectY: 50 - offsetY,
    objectFit: scale < 1 ? 'contain' : 'cover',
  };
}
