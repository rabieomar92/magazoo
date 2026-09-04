export interface ImageFrame {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface FramedImageGeometry {
  width: number;
  height: number;
  left: number;
  top: number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export function normalizeImageFrame(frame?: Partial<ImageFrame>): ImageFrame {
  return {
    scale: clamp(Number.isFinite(frame?.scale) ? frame!.scale! : 1, 0.5, 3),
    offsetX: clamp(Number.isFinite(frame?.offsetX) ? frame!.offsetX! : 0, -50, 50),
    offsetY: clamp(Number.isFinite(frame?.offsetY) ? frame!.offsetY! : 0, -50, 50),
  };
}

/**
 * Position one axis without ever introducing an accidental uncovered edge.
 * When the bitmap is larger, the offset consumes only crop space. When zoomed
 * out, it moves only through the free space, so the whole bitmap stays visible.
 */
export function framedAxis(container: number, content: number, offset: number): number {
  const room = Math.abs(content - container);
  const centred = (container - content) / 2;
  const safeOffset = clamp(Number.isFinite(offset) ? offset : 0, -50, 50);
  return centred + (safeOffset / 50) * (room / 2);
}

/** Resolve cover-fit pixels from the real source and frame dimensions. */
export function framedImageGeometry(
  sourceWidth: number,
  sourceHeight: number,
  containerWidth: number,
  containerHeight: number,
  frame?: Partial<ImageFrame>,
): FramedImageGeometry {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { width: 0, height: 0, left: 0, top: 0 };
  }
  const safeSourceWidth = sourceWidth > 0 ? sourceWidth : containerWidth;
  const safeSourceHeight = sourceHeight > 0 ? sourceHeight : containerHeight;
  const resolved = normalizeImageFrame(frame);
  const coverScale = Math.max(
    containerWidth / safeSourceWidth,
    containerHeight / safeSourceHeight,
  );
  const width = safeSourceWidth * coverScale * resolved.scale;
  const height = safeSourceHeight * coverScale * resolved.scale;
  return {
    width,
    height,
    left: framedAxis(containerWidth, width, resolved.offsetX),
    top: framedAxis(containerHeight, height, resolved.offsetY),
  };
}
