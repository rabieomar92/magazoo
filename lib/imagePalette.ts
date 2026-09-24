/** Dominant colour in the bottom part of a photograph, ignoring transparency.
 * Quantization avoids averaging complementary colours into muddy grey. */
export function imagePalette(pixels: ArrayLike<number>) {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
  }
  const best = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  if (!best) return null;
  const rgb = [best.r, best.g, best.b].map(v => Math.round(v / best.n));
  const background = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  const linear = rgb.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  // Choose the higher contrast option (at least 4.58:1 for any opaque colour).
  const ink = luminance > .179 ? '#000000' : '#ffffff';
  const soft = '#' + rgb.map(v => Math.round(v * .18 + (ink === '#ffffff' ? 255 : 0) * .82).toString(16).padStart(2, '0')).join('');
  return { background, ink, soft };
}
