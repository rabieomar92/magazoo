import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';

/** Optional artwork behind the document's first physical page. */
export function PageArtwork({ doc }: { doc: Doc }) {
  const assetId = doc.design.pageBackgroundAssetId;
  const asset = assetId ? doc.assets[assetId] : null;
  if (!asset) return null;

  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    maxHeight: 'none',
    objectFit: 'cover',
    objectPosition: 'center',
    opacity: doc.design.pageBackgroundOpacity ?? 1,
    zIndex: 0,
    pointerEvents: 'auto',
    userSelect: 'none',
  };

  return (
    <img
      className="page-artwork"
      data-editor-tab="design"
      data-editor-target="design-background"
      src={asset.src}
      alt=""
      aria-hidden="true"
      title="Edit page background"
      draggable={false}
      decoding="async"
      style={style}
    />
  );
}
