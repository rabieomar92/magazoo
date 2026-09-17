import type { CSSProperties } from 'react';
import type { Asset } from '../schema/document';
import type { SplitPhoto } from '../lib/magSplit';

interface Props {
  asset: Asset;
  geometry: SplitPhoto;
  className?: string;
  /** Shift this full-page image below artwork/content layers, like a CSS background. */
  behind?: boolean;
}

/**
 * A real image element for one precisely cropped window of a spread photo.
 *
 * Magazine 2 and 3 formerly embedded multi-megabyte data URLs in inline CSS
 * background declarations. Chromium can discard those declarations under
 * memory pressure even while an <img> using the same asset remains visible.
 * Explicit millimetre geometry preserves the exact old crop and seam while a
 * real <img> gives the browser (and PDF readiness checks) a reliable resource.
 */
export function SpreadPhotoImage({ asset, geometry, className, behind = false }: Props) {
  const style: CSSProperties = {
    position: 'absolute',
    left: `${geometry.x}mm`,
    top: `${geometry.y}mm`,
    width: `${geometry.w}mm`,
    height: `${geometry.h}mm`,
    maxWidth: 'none',
    maxHeight: 'none',
    objectFit: 'fill',
    objectPosition: 'center',
    transform: 'none',
    zIndex: behind ? -1 : undefined,
    pointerEvents: 'none',
    userSelect: 'none',
  };

  return (
    <img
      className={`spread-photo-image${className ? ` ${className}` : ''}`}
      src={asset.src}
      alt=""
      draggable={false}
      decoding="async"
      style={style}
    />
  );
}
