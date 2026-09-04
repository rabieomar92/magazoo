import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { Asset } from '../schema/document';
import {
  framedImageGeometry,
  normalizeImageFrame,
  type ImageFrame,
} from '../lib/imageFrame';

interface Props {
  asset: Asset;
  frame?: Partial<ImageFrame>;
  className?: string;
  style?: CSSProperties;
}

/**
 * A measured image layer shared by every fixed photo frame. It uses the real
 * source and container aspect ratios, so pan is bounded to crop/free space and
 * preview zoom cannot reveal a template colour by moving the image box away.
 */
export function FramedImage({ asset, frame, className, style }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const resolved = normalizeImageFrame(frame);

  useLayoutEffect(() => {
    const image = imageRef.current;
    const container = image?.parentElement;
    if (!image || !container) return;

    const apply = () => {
      const computed = getComputedStyle(container);
      const measuredWidth = Number.parseFloat(computed.width);
      const measuredHeight = Number.parseFloat(computed.height);
      const geometry = framedImageGeometry(
        asset.naturalWidth,
        asset.naturalHeight,
        measuredWidth > 0 ? measuredWidth : container.clientWidth,
        measuredHeight > 0 ? measuredHeight : container.clientHeight,
        resolved,
      );
      if (!geometry.width || !geometry.height) return;
      image.style.inset = 'auto';
      image.style.width = `${geometry.width}px`;
      image.style.height = `${geometry.height}px`;
      image.style.left = `${geometry.left}px`;
      image.style.top = `${geometry.top}px`;
      image.style.maxWidth = 'none';
      image.style.maxHeight = 'none';
      image.style.objectFit = 'fill';
      image.style.objectPosition = 'center';
      image.style.transform = 'none';
    };

    apply();
    image.addEventListener('load', apply);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(container);
    return () => {
      image.removeEventListener('load', apply);
      observer?.disconnect();
    };
  }, [asset.naturalHeight, asset.naturalWidth, resolved]);

  return (
    <img
      ref={imageRef}
      className={`framed-image${className ? ` ${className}` : ''}`}
      src={asset.src}
      alt=""
      draggable={false}
      data-frame-scale={resolved.scale}
      data-frame-x={resolved.offsetX}
      data-frame-y={resolved.offsetY}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: resolved.scale < 1 ? 'contain' : 'cover',
        objectPosition: 'center',
        transform: resolved.scale > 1 ? `scale(${resolved.scale})` : undefined,
        ...style,
      }}
    />
  );
}
