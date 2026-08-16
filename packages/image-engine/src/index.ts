/**
 * @pdf-saas/image-engine
 * Browser-native image processing (Canvas / OffscreenCanvas).
 * Designed to run inside a Web Worker: `createImageBitmap` decodes blobs,
 * draw to OffscreenCanvas, `convertToBlob` re-encodes.
 *
 * These functions require a browser environment.
 */

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit: 'cover' | 'contain' | 'stretch';
}

export interface ImageInfo {
  width: number;
  height: number;
  mime: string;
  size: number;
}

export function formatToExtension(format: ImageFormat): string {
  if (format === 'image/jpeg') return 'jpg';
  if (format === 'image/webp') return 'webp';
  return 'png';
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

function canvasToBlob(canvas: OffscreenCanvas, format: ImageFormat, quality: number): Promise<Blob> {
  return canvas.convertToBlob({ type: format, quality });
}

export async function getImageInfo(blob: Blob): Promise<ImageInfo> {
  const bitmap = await loadBitmap(blob);
  const info: ImageInfo = { width: bitmap.width, height: bitmap.height, mime: blob.type, size: blob.size };
  bitmap.close();
  return info;
}

export async function resizeImage(blob: Blob, opts: ResizeOptions): Promise<Blob> {
  const bitmap = await loadBitmap(blob);
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  let w = opts.width ?? srcW;
  let h = opts.height ?? srcH;

  if (opts.fit === 'contain' || opts.fit === 'cover') {
    if (opts.width && opts.height) {
      const ratio = Math.min(
        opts.width / srcW,
        opts.height / srcH
      );
      if (opts.fit === 'cover') {
        w = opts.width;
        h = opts.height;
      } else {
        w = Math.round(srcW * ratio);
        h = Math.round(srcH * ratio);
      }
    } else if (opts.width) {
      h = Math.round((srcH / srcW) * opts.width);
    } else if (opts.height) {
      w = Math.round((srcW / srcH) * opts.height);
    }
  }

  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D context unavailable.');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const format: ImageFormat = blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type as ImageFormat : 'image/jpeg';
  return canvasToBlob(canvas, format, format === 'image/jpeg' ? 0.9 : 0.9);
}

export async function convertImage(blob: Blob, format: ImageFormat, quality = 0.9): Promise<Blob> {
  const bitmap = await loadBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D context unavailable.');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToBlob(canvas, format, quality);
}

export async function compressImage(blob: Blob, quality: number, format: ImageFormat): Promise<Blob> {
  return convertImage(blob, format, quality);
}

export async function cropImage(
  blob: Blob,
  rect: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const bitmap = await loadBitmap(blob);
  const w = Math.max(1, Math.round(Math.min(rect.width, bitmap.width - rect.x)));
  const h = Math.max(1, Math.round(Math.min(rect.height, bitmap.height - rect.y)));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D context unavailable.');
  }
  ctx.drawImage(bitmap, rect.x, rect.y, w, h, 0, 0, w, h);
  bitmap.close();
  const format: ImageFormat = blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type as ImageFormat : 'image/jpeg';
  return canvasToBlob(canvas, format, 0.92);
}
