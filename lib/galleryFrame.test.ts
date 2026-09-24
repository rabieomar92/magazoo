import { describe, expect, it } from 'vitest';
import { galleryFrameGeometry } from './galleryFrame';

describe('gallery image framing', () => {
  it('keeps both centre-fold halves on one shared coordinate system', () => {
    const frame = { scale: 1.8, offsetX: -24, offsetY: 17 };
    const left = galleryFrameGeometry(frame, 2);
    const rightLocalLeft = left.left - 100;

    expect(rightLocalLeft + 100).toBeCloseTo(left.left);
    expect(left.width).toBeCloseTo(360);
    expect(left.height).toBeCloseTo(180);
  });

  it('never exposes an empty edge at any supported zoom or pan extreme', () => {
    for (const span of [1, 2] as const) {
      for (const scale of [1, 1.1, 2, 3]) {
        for (const offsetX of [-50, -24, 0, 50]) {
          for (const offsetY of [-50, 0, 50]) {
            const geometry = galleryFrameGeometry({ scale, offsetX, offsetY }, span);
            expect(geometry.left).toBeLessThanOrEqual(0);
            expect(geometry.left + geometry.width).toBeGreaterThanOrEqual(span * 100);
            expect(geometry.top).toBeLessThanOrEqual(0);
            expect(geometry.top + geometry.height).toBeGreaterThanOrEqual(100);
          }
        }
      }
    }
  });

  it('allows zooming out to reveal the whole image and keeps it inside the tile', () => {
    const geometry = galleryFrameGeometry({ scale: 0.5, offsetX: 50, offsetY: -50 });
    expect(geometry).toMatchObject({
      width: 50,
      height: 50,
      left: 50,
      top: 0,
      objectFit: 'contain',
    });
  });

  it('clamps corrupt persisted values to the supported frame range', () => {
    const geometry = galleryFrameGeometry(
      { scale: Number.NaN, offsetX: 999, offsetY: -999 },
      1,
    );
    expect(geometry).toEqual({
      width: 100,
      height: 100,
      left: 0,
      top: 0,
      objectX: 0,
      objectY: 100,
      objectFit: 'cover',
    });
  });
});
