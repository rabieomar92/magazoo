import { describe, expect, it } from 'vitest';
import { PAGE_H, PAGE_W } from './geometry';
import {
  MAG2_STRIP,
  framedSpreadPhoto,
  gatePageBg,
  photoPageBg,
  splitPhoto,
  stripBg,
} from './magSplit';

describe('continuous spread-photo framing', () => {
  it('keeps magazine-2 windows exactly one strip width apart', () => {
    const photo = splitPhoto(16 / 9, { scale: 1.4, offsetX: -24, offsetY: 17 });
    const strip = stripBg(photo);
    const page = photoPageBg(photo);

    const stripX = Number.parseFloat(strip.backgroundPosition);
    const pageX = Number.parseFloat(page.backgroundPosition);
    expect(stripX - pageX).toBeCloseTo(MAG2_STRIP);
  });

  it('keeps conventional gatefold windows exactly one page width apart', () => {
    const photo = framedSpreadPhoto(3 / 2, PAGE_W * 2, PAGE_H, {
      scale: 2,
      offsetX: 31,
      offsetY: -12,
    });
    const left = gatePageBg(photo, 0);
    const right = gatePageBg(photo, 1);
    const leftX = Number.parseFloat(left.backgroundPosition);
    const rightX = Number.parseFloat(right.backgroundPosition);
    expect(leftX - rightX).toBeCloseTo(PAGE_W);
  });

  it('cannot pan a zoomed image beyond any region edge', () => {
    const regionW = PAGE_W * 2;
    for (const scale of [1, 1.1, 2, 3]) {
      for (const offsetX of [-50, 0, 50]) {
        for (const offsetY of [-50, 0, 50]) {
          const photo = framedSpreadPhoto(4 / 3, regionW, PAGE_H, {
            scale,
            offsetX,
            offsetY,
          });
          expect(photo.x).toBeLessThanOrEqual(0);
          expect(photo.x + photo.w).toBeGreaterThanOrEqual(regionW);
          expect(photo.y).toBeLessThanOrEqual(0);
          expect(photo.y + photo.h).toBeGreaterThanOrEqual(PAGE_H);
        }
      }
    }
  });

  it('keeps the whole bitmap inside the spread while zoomed out', () => {
    const regionW = PAGE_W * 2;
    const photo = framedSpreadPhoto(16 / 9, regionW, PAGE_H, {
      scale: 0.5,
      offsetX: 50,
      offsetY: -50,
    });
    if (photo.w < regionW) {
      expect(photo.x).toBeGreaterThanOrEqual(0);
      expect(photo.x + photo.w).toBeLessThanOrEqual(regionW);
    }
    if (photo.h < PAGE_H) {
      expect(photo.y).toBeGreaterThanOrEqual(0);
      expect(photo.y + photo.h).toBeLessThanOrEqual(PAGE_H);
    }
  });
});

