import { useEffect, useMemo, useState } from 'react';
import type { Doc } from '../schema/document';
import { imagePalette } from '../lib/imagePalette';

export function useImageTheme(source: Doc): Doc {
  const enabled = source.templateId === 'paper-3' && source.design.imageTheme !== false;
  const src = enabled && source.hero.assetId ? source.assets[source.hero.assetId]?.src : undefined;
  const bottom = source.design.heroAtBottom === true;
  const [sample, setSample] = useState<{ src: string; bottom: boolean; palette: ReturnType<typeof imagePalette> } | null>(null);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48; canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        // Sample the edge that meets the article, including when the photo rises from below.
        ctx.drawImage(image, 0, bottom ? 0 : image.naturalHeight * .65, image.naturalWidth, image.naturalHeight * .35, 0, 0, 48, 16);
        setSample({ src, bottom, palette: imagePalette(ctx.getImageData(0, 0, 48, 16).data) });
      } catch { /* Unreadable external images retain the editable manual theme. */ }
    };
    image.src = src;
    return () => { cancelled = true; image.onload = null; };
  }, [src, bottom]);
  const palette = sample && sample.src === src && sample.bottom === bottom ? sample.palette : null;
  return useMemo(() => {
    if (source.templateId !== 'paper-3') return source;
    // Paper 3 deliberately never paints a photograph behind the article text.
    const design = { ...source.design, pageBackgroundAssetId: undefined };
    if (enabled && palette) {
      design.paperBg = palette.background;
      design.colors = { hero: palette.background, ink: palette.ink, accent: palette.ink, accentSoft: palette.soft };
      // Explicit per-object choices still win over the generated theme.
    }
    return { ...source, design };
  }, [source, enabled, palette]);
}
