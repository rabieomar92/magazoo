import { describe, expect, it } from 'vitest';
import { imagePalette } from './imagePalette';
describe('image matched palette', () => {
  it('ignores transparent pixels and chooses the dominant colour', () => {
    expect(imagePalette([255,0,0,0, 0,80,60,255, 0,80,60,255, 240,0,0,255])).toMatchObject({ background:'#00503c',ink:'#ffffff' });
  });
  it('chooses dark ink for light images and handles no usable pixels', () => {
    expect(imagePalette([220,230,240,255])?.ink).toBe('#000000');
    expect(imagePalette([0,0,0,0])).toBeNull();
  });
});
