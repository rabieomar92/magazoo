/**
 * Decode and embed an uploaded image in a document.
 *
 * Documents are autosaved to IndexedDB and exported as self-contained JSON, so
 * storing an untouched 20–50 MB camera original is both wasteful and unreliable
 * (especially on mobile). Small images are preserved byte-for-byte. Large or
 * extremely high-resolution images are rasterised once to a print-safe size and
 * compressed before they enter the document. Preview and PDF therefore always
 * use the exact same embedded pixels.
 */

export interface LoadedImage {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

/** A source this large is unsafe to decode in a browser at all. */
export const MAX_SOURCE_IMAGE_BYTES = 64 * 1024 * 1024;
/** Keep embedded assets compact enough for reliable autosave and JSON export. */
export const MAX_EMBEDDED_IMAGE_BYTES = 8 * 1024 * 1024;
/** 3200 px remains print-sharp on A4 while avoiding oversized decode surfaces. */
export const MAX_IMAGE_EDGE = 3200;
/** A decoded image uses roughly four bytes per pixel; cap each asset near 32 MB. */
export const MAX_IMAGE_PIXELS = 8 * 1024 * 1024;

/** @deprecated Use MAX_SOURCE_IMAGE_BYTES for upload validation. */
export const MAX_IMAGE_BYTES = MAX_SOURCE_IMAGE_BYTES;

export class ImageLoadError extends Error {}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ImageLoadError('Failed to read the image file.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function decodeFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const release = () => URL.revokeObjectURL(objectUrl);

    image.onerror = () => {
      release();
      reject(
        new ImageLoadError(
          'This image could not be decoded. Convert HEIC/RAW files to JPEG, PNG, or WebP and try again.',
        ),
      );
    };
    image.onload = () => {
      release();
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new ImageLoadError('The image has invalid dimensions.'));
        return;
      }
      resolve(image);
    };
    image.src = objectUrl;
  });
}

/** Calculate a safe raster size without changing the aspect ratio. */
export function normalizedImageSize(width: number, height: number): { width: number; height: number } {
  const edgeScale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(MAX_IMAGE_PIXELS / (width * height)));
  const scale = Math.min(edgeScale, pixelScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new ImageLoadError('The browser could not optimise this image.'));
      },
      type,
      quality,
    );
  });
}

async function rasterize(
  image: HTMLImageElement,
  width: number,
  height: number,
  sourceType: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageLoadError('The browser could not prepare this image.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  // WebP preserves transparency and is substantially smaller than PNG. JPEG
  // camera originals stay JPEG so browsers without WebP encoding still have a
  // dependable fallback format.
  const outputType = sourceType === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  let quality = 0.94;
  let encoded = await canvasToBlob(canvas, outputType, quality);

  // Highly detailed/noisy images can still exceed the autosave target. Reduce
  // quality gradually; dimensions and layout remain unchanged.
  while (encoded.size > MAX_EMBEDDED_IMAGE_BYTES && quality > 0.76) {
    quality -= 0.06;
    encoded = await canvasToBlob(canvas, outputType, quality);
  }
  return encoded;
}

export async function loadImage(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageLoadError('The file is not an image.');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    const mb = Math.round(MAX_SOURCE_IMAGE_BYTES / (1024 * 1024));
    throw new ImageLoadError(`Image is too large to process safely (max ${mb} MB).`);
  }

  const image = await decodeFile(file);
  const size = normalizedImageSize(image.naturalWidth, image.naturalHeight);
  const needsOptimising =
    file.size > MAX_EMBEDDED_IMAGE_BYTES ||
    size.width !== image.naturalWidth ||
    size.height !== image.naturalHeight;

  if (!needsOptimising) {
    return {
      src: await blobToDataUrl(file),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
  }

  const embedded = await rasterize(image, size.width, size.height, file.type);
  if (embedded.size > MAX_EMBEDDED_IMAGE_BYTES) {
    throw new ImageLoadError(
      'The image remains too large after optimisation. Please export it as JPEG or WebP and try again.',
    );
  }
  return {
    src: await blobToDataUrl(embedded),
    naturalWidth: size.width,
    naturalHeight: size.height,
  };
}
