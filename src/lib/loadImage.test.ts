import { describe, expect, it } from 'vitest';
import {
  loadImage,
  ImageLoadError,
  MAX_SOURCE_IMAGE_BYTES,
  MAX_EMBEDDED_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  normalizedImageSize,
} from './loadImage';

// The decode paths (FileReader/Image onload) need a real browser; jsdom can't
// decode. But the guards that matter for storage safety — wrong type, too big —
// reject synchronously before any read, so they're testable here.

function fileOfSize(bytes: number, type: string): File {
  const f = new File(['x'], 'pic', { type });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

describe('loadImage', () => {
  it('rejects a non-image file', async () => {
    const pdf = fileOfSize(1000, 'application/pdf');
    await expect(loadImage(pdf)).rejects.toBeInstanceOf(ImageLoadError);
  });

  it('rejects a source file larger than the safe decode cap', async () => {
    const huge = fileOfSize(MAX_SOURCE_IMAGE_BYTES + 1, 'image/png');
    await expect(loadImage(huge)).rejects.toBeInstanceOf(ImageLoadError);
  });

  it('allows a source at the decode cap past the size guard', async () => {
    // At exactly the cap the size check passes; we only assert it does NOT
    // reject with a size/type error (decode won't complete under jsdom, so we
    // race it against a tick and require no synchronous rejection).
    const atCap = fileOfSize(MAX_SOURCE_IMAGE_BYTES, 'image/png');
    const settled = await Promise.race([
      loadImage(atCap).then(
        () => 'resolved',
        (e) => (e instanceof ImageLoadError && /large|not an image/i.test(e.message) ? 'guard-rejected' : 'decoding'),
      ),
      new Promise((r) => setTimeout(() => r('pending'), 10)),
    ]);
    expect(settled).not.toBe('guard-rejected');
  });

  it('does not reject an image merely because it exceeds the embedded-size target', async () => {
    const compressible = fileOfSize(MAX_EMBEDDED_IMAGE_BYTES + 1, 'image/jpeg');
    const settled = await Promise.race([
      loadImage(compressible).then(
        () => 'resolved',
        (e) => (e instanceof ImageLoadError && /too large to process/i.test(e.message) ? 'guard-rejected' : 'decoding'),
      ),
      new Promise((r) => setTimeout(() => r('pending'), 10)),
    ]);
    expect(settled).not.toBe('guard-rejected');
  });
});

describe('normalizedImageSize', () => {
  it('preserves ordinary images exactly', () => {
    expect(normalizedImageSize(2400, 1600)).toEqual({ width: 2400, height: 1600 });
  });

  it('limits the longest edge while preserving aspect ratio', () => {
    expect(normalizedImageSize(8192, 4096)).toEqual({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE / 2,
    });
  });

  it('limits total pixels for very square images', () => {
    const result = normalizedImageSize(6000, 6000);
    expect(result.width * result.height).toBeLessThanOrEqual(MAX_IMAGE_PIXELS);
    expect(result.width).toBe(result.height);
  });
});
