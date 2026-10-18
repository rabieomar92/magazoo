import { expect, it } from 'vitest';
import { unscaledVerticalOffset } from './previewGeometry';

it.each([0.35, 0.6, 0.96, 1, 1.5])('keeps title offsets unchanged at preview zoom %s', scale => {
  const container = document.createElement('header');
  const title = document.createElement('h1');
  container.style.width = '480.25px';
  container.getBoundingClientRect = () => ({ top: 100, width: 480.25 * scale } as DOMRect);
  title.getBoundingClientRect = () => ({ top: 100 + 24.5 * scale } as DOMRect);
  expect(unscaledVerticalOffset(title, container)).toBeCloseTo(24.5, 8);
});
