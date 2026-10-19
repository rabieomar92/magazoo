import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { Asset } from '../schema/document';
import '../styles/image-pan.css';
import {cropClip} from '../lib/imageCrop';
import {
  framedImageGeometry,
  normalizeImageFrame,
  hasImagePan,
  type ImageFrame,
  type ImageFit,
} from '../lib/imageFrame';

interface Props {
  asset: Asset;
  frame?: Partial<ImageFrame>;
  fit?: ImageFit;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

/**
 * A measured image layer shared by every fixed photo frame. It uses the real
 * source and container aspect ratios. Existing crop focus stays bounded;
 * optional free pan can deliberately uncover the page background.
 */
export function FramedImage({ asset, frame, fit = 'cover', className, style,alt='' }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const resolved = normalizeImageFrame(frame);
  const {scale,offsetX,offsetY,panX,panY}=resolved;

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
        {scale,offsetX,offsetY,panX,panY},
        fit,
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
      image.style.clipPath=cropClip(frame?.crop,measuredWidth||container.clientWidth,measuredHeight||container.clientHeight,geometry.left,geometry.top);
    };

    apply();
    image.addEventListener('load', apply);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(container);
    return () => {
      image.removeEventListener('load', apply);
      observer?.disconnect();
    };
  // normalizeImageFrame returns a new object. Depending on that object used to
  // measure every photograph and recreate its observer on every text edit.
  }, [asset.naturalHeight, asset.naturalWidth, fit, scale,offsetX,offsetY,panX,panY,frame?.crop]);

  return (
    <img
      ref={imageRef}
      className={`framed-image${className ? ` ${className}` : ''}`}
      src={asset.src}
      alt={alt}
      draggable={false}
      data-frame-scale={resolved.scale}
      data-frame-x={resolved.offsetX}
      data-frame-y={resolved.offsetY}
      data-frame-pan-x={resolved.panX}
      data-frame-pan-y={resolved.panY}
      data-image-free-pan={hasImagePan(resolved) ? 'true' : undefined}
      data-image-fit={fit}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: fit === 'contain' || resolved.scale < 1 ? 'contain' : 'cover',
        objectPosition: 'center',
        transform: resolved.scale > 1 ? `scale(${resolved.scale})` : undefined,
        ...style,
      }}
    />
  );
}
