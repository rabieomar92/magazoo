import { describe, expect, it } from 'vitest';
import { framedImageGeometry, normalizeImageFrame } from './imageFrame';

describe('bounded image framing', () => {
  it('fills a frame at 1x without exposing an edge at any pan extreme', () => {
    for (const offsetX of [-50, 0, 50]) {
      for (const offsetY of [-50, 0, 50]) {
        const out = framedImageGeometry(800, 1200, 600, 400, {
          scale: 1,
          offsetX,
          offsetY,
        });
        expect(out.left).toBeLessThanOrEqual(0);
        expect(out.top).toBeLessThanOrEqual(0);
        expect(out.left + out.width).toBeGreaterThanOrEqual(600);
        expect(out.top + out.height).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it('reveals more of the source below 1x while keeping the bitmap in-frame', () => {
    const out = framedImageGeometry(800, 1200, 600, 400, {
      scale: 0.5,
      offsetX: 50,
      offsetY: -50,
    });
    expect(out.width).toBe(300);
    expect(out.height).toBe(450);
    expect(out.left).toBe(300);
    expect(out.top).toBe(-50);
  });

  it('clamps damaged saved values to the supported range', () => {
    expect(normalizeImageFrame({ scale: 99, offsetX: -999, offsetY: Number.NaN })).toEqual({
      scale: 3,
      offsetX: -50,
      offsetY: 0,
    });
  });
});
