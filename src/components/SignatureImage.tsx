import type { Asset } from '../schema/document';
import { normalizeSignatureCrop, type SignatureCrop } from '../lib/signature';

/** Original pixels, uniformly scaled. The viewport crops margins without
 * changing the saved image or its proportions in preview and print. */
export function SignatureImage({ asset, crop, blend = false }: { asset: Asset; crop?: SignatureCrop; blend?: boolean }) {
  const rect = normalizeSignatureCrop(crop);
  const width = Number.isFinite(asset.naturalWidth) && asset.naturalWidth > 0 ? asset.naturalWidth : 3;
  const height = Number.isFinite(asset.naturalHeight) && asset.naturalHeight > 0 ? asset.naturalHeight : 1;
  return <svg className="signature-art" aria-hidden="true"
    viewBox={`${rect.x * width} ${rect.y * height} ${rect.width * width} ${rect.height * height}`}
    style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: `${rect.width * width} / ${rect.height * height}`, overflow: 'hidden', mixBlendMode: blend ? 'multiply' : undefined }}>
    <image href={asset.src} width={width} height={height} />
  </svg>;
}
