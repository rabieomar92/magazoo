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
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

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
  const scale = Math.max(1, Number.isFinite(frame?.scale) ? frame!.scale : 1);
  const offsetX = clamp(Number.isFinite(frame?.offsetX) ? frame!.offsetX : 0, -50, 50);
  const offsetY = clamp(Number.isFinite(frame?.offsetY) ? frame!.offsetY : 0, -50, 50);
  const extra = scale - 1;

  return {
    width: spanX * 100 * scale,
    height: 100 * scale,
    // Offset sliders consume only the extra area created by zoom. At 1× the
    // element remains flush and object-position pans any intrinsic cover crop.
    left: extra === 0 ? 0 : spanX * extra * (offsetX - 50),
    top: extra === 0 ? 0 : extra * (offsetY - 50),
    objectX: 50 - offsetX,
    objectY: 50 - offsetY,
  };
}
