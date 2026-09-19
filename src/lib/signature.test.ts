import { describe, expect, it } from 'vitest';
import { normalizeSignatureCrop, signatureGeometry, signatureInkBounds } from './signature';

describe('signature sizing', () => {
  const asset = { src: 'test', naturalWidth: 1200, naturalHeight: 300 };
  it('uses the real image proportions and one physical width, independent of legacy zoom', () => {
    const size = signatureGeometry(asset, { signatureWidth: 40, signature: { assetId: 'x', offsetX: 50, offsetY: -50, scale: 3 } });
    expect(size.width).toBe(40); expect(size.height).toBe(10);
  });
  it('contains wide and tall images without distortion and clamps invalid saved settings', () => {
    expect(signatureGeometry(asset, { signatureWidth: 80 }, 22).width).toBe(59);
    const tall = signatureGeometry({ ...asset, naturalWidth: 300, naturalHeight: 1200 }, { signatureWidth: 80 });
    expect(tall.height).toBe(55); expect(tall.width / tall.height).toBe(.25);
    expect(signatureGeometry(asset, { signatureWidth: NaN, signatureGap: Infinity }).width).toBe(34);
    expect(signatureGeometry(asset, { signatureWidth: -2, signatureGap: -5 }).gap).toBe(0);
  });
  it('uses the cropped proportions while keeping the source unchanged', () => {
    const size = signatureGeometry(asset, { signatureWidth: 40, signatureCrop: { x: .25, y: .25, width: .5, height: .5 } });
    expect(size.height).toBe(10);
    expect(asset.naturalWidth).toBe(1200);
    expect(normalizeSignatureCrop({ x: NaN, y: 0, width: 0, height: 1 })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(normalizeSignatureCrop({ x: .9, y: .9, width: .5, height: .5 }).width).toBeCloseTo(.1);
  });
});

describe('reversible signature margin trimming', () => {
  it.each(['white', 'transparent'])('finds padded ink bounds on a %s background', background => {
    const pixels = new Uint8ClampedArray(100 * 80 * 4);
    if (background === 'white') pixels.fill(255);
    for (let y = 30; y < 50; y++) for (let x = 20; x < 80; x++) {
      const i = (y * 100 + x) * 4;
      pixels[i] = 10; pixels[i + 1] = 30; pixels[i + 2] = 80; pixels[i + 3] = 255;
    }
    expect(signatureInkBounds(pixels, 100, 80)).toEqual({ x: .18, y: .35, width: .64, height: .3 });
  });
  it('does not crop a blank scan or discard ink touching an edge', () => {
    const blank = new Uint8ClampedArray(10 * 10 * 4).fill(255);
    expect(signatureInkBounds(blank, 10, 10)).toBeNull();
    blank[0] = 0;
    expect(signatureInkBounds(blank, 10, 10)?.x).toBe(0);
  });
});
