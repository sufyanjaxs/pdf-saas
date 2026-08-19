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

export interface ImageAnalysis extends ImageInfo {
  aspectRatio: number;
  megapixels: number;
  hasAlpha: boolean;
  format: string;
  /** Estimated quality 0-100 based on file size relative to dimensions */
  estimatedQuality: number;
  /** Complexity score 0-1 (higher = more detail/entropy) */
  complexity: number;
  /** Human-readable quality label */
  qualityLabel: string;
}

export interface CompressAdvancedOptions {
  /** Target output format. If null, preserves original. */
  format?: ImageFormat | null;
  /** Quality slider 0-100. Ignored when targetSizeKB is set. */
  quality?: number;
  /** Target file size in KB. Uses binary search over quality. */
  targetSizeKB?: number;
  /** Minimum quality floor for target-size search (default 5) */
  minQuality?: number;
  /** Maximum quality ceiling for target-size search (default 95) */
  maxQuality?: number;
}

export interface CompressAdvancedResult {
  blob: Blob;
  width: number;
  height: number;
  size: number;
  quality: number;
  format: ImageFormat;
}

export function formatToExtension(format: ImageFormat): string {
  if (format === 'image/jpeg') return 'jpg';
  if (format === 'image/webp') return 'webp';
  return 'png';
}

export function detectFormat(mime: string): ImageFormat {
  if (mime === 'image/png') return 'image/png';
  if (mime === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

function canvasToBlob(canvas: OffscreenCanvas, format: ImageFormat, quality: number): Promise<Blob> {
  return canvas.convertToBlob({ type: format, quality });
}

/**
 * Check if an image has meaningful alpha transparency.
 * Samples pixels from the image and checks if any have alpha < 255.
 */
export async function hasTransparency(blob: Blob): Promise<boolean> {
  if (blob.type === 'image/png' || blob.type === 'image/webp') {
    const bitmap = await loadBitmap(blob);
    const w = Math.min(bitmap.width, 100);
    const h = Math.min(bitmap.height, 100);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return false; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  }
  return false;
}

/**
 * Estimate image complexity by measuring pixel variance (simplified entropy).
 * Returns a value between 0 (flat/uniform) and 1 (highly detailed).
 */
export async function estimateComplexity(blob: Blob): Promise<number> {
  const bitmap = await loadBitmap(blob);
  const w = Math.min(bitmap.width, 200);
  const h = Math.min(bitmap.height, 200);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); return 0.5; }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const pixelCount = w * h;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    sum += gray;
    sumSq += gray * gray;
  }
  const mean = sum / pixelCount;
  const variance = sumSq / pixelCount - mean * mean;
  // Normalize: natural images typically have variance 200-4000
  return Math.min(1, Math.max(0, variance / 4000));
}

export async function getImageInfo(blob: Blob): Promise<ImageInfo> {
  const bitmap = await loadBitmap(blob);
  const info: ImageInfo = { width: bitmap.width, height: bitmap.height, mime: blob.type, size: blob.size };
  bitmap.close();
  return info;
}

/**
 * Full image analysis: dimensions, format, transparency, complexity,
 * estimated quality from size/dimensions ratio.
 */
export async function analyzeImage(blob: Blob): Promise<ImageAnalysis> {
  const bitmap = await loadBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  const mime = blob.type;
  const size = blob.size;
  bitmap.close();

  const aspectRatio = width / height;
  const megapixels = (width * height) / 1_000_000;
  const alpha = await hasTransparency(blob);
  const complexity = await estimateComplexity(blob);

  const formatName = mime === 'image/png' ? 'PNG' : mime === 'image/webp' ? 'WEBP' : 'JPEG';

  // Estimate quality from bytes-per-pixel ratio
  // Typical: JPEG @ q90 ≈ 0.5-2 bpp, PNG ≈ 2-8 bpp, WEBP ≈ 0.3-1.5 bpp
  const bpp = size / (width * height || 1);
  let estimatedQuality: number;
  if (mime === 'image/jpeg') {
    // JPEG: roughly q=100 → 2-4 bpp, q=10 → 0.05-0.1 bpp
    estimatedQuality = Math.min(100, Math.max(0, Math.round(bpp * 60)));
  } else if (mime === 'image/webp') {
    estimatedQuality = Math.min(100, Math.max(0, Math.round(bpp * 80)));
  } else {
    // PNG is lossless; "quality" is more about compression efficiency
    estimatedQuality = bpp > 3 ? 85 : bpp > 1 ? 70 : 55;
  }

  let qualityLabel: string;
  if (estimatedQuality >= 85) qualityLabel = 'High';
  else if (estimatedQuality >= 65) qualityLabel = 'Medium';
  else if (estimatedQuality >= 40) qualityLabel = 'Low';
  else qualityLabel = 'Very Low';

  return {
    width, height, mime, size,
    aspectRatio, megapixels, hasAlpha: alpha,
    format: formatName, estimatedQuality, complexity, qualityLabel,
  };
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

/**
 * Create a circular crop of an image. Returns transparent PNG.
 */
export async function circleCrop(blob: Blob): Promise<Blob> {
  const bitmap = await loadBitmap(blob);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); throw new Error('Canvas 2D context unavailable.'); }

  const offsetX = (bitmap.width - size) / 2;
  const offsetY = (bitmap.height - size) / 2;

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(bitmap, offsetX, offsetY, size, size, 0, 0, size, size);
  bitmap.close();
  return canvasToBlob(canvas, 'image/png', 1);
}

/**
 * Create a circular crop with a solid background color behind the circle.
 */
export async function circleCropWithBackground(
  blob: Blob,
  bgColor: string,
  borderWidth: number = 0,
  borderColor: string = '#ffffff'
): Promise<Blob> {
  const bitmap = await loadBitmap(blob);
  const size = Math.min(bitmap.width, bitmap.height);
  const totalSize = size + borderWidth * 2;
  const canvas = new OffscreenCanvas(totalSize, totalSize);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); throw new Error('Canvas 2D context unavailable.'); }

  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, totalSize, totalSize);

  // Draw border circle if specified
  if (borderWidth > 0) {
    ctx.beginPath();
    ctx.arc(totalSize / 2, totalSize / 2, size / 2 + borderWidth, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = borderColor;
    ctx.fill();
  }

  // Clip to inner circle
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Draw image centered
  const offsetX = (bitmap.width - size) / 2;
  const offsetY = (bitmap.height - size) / 2;
  ctx.drawImage(bitmap, offsetX, offsetY, size, size, borderWidth, borderWidth, size, size);
  bitmap.close();
  return canvasToBlob(canvas, 'image/png', 1);
}

/**
 * Fill background with a solid color (replaces transparency).
 */
export async function fillBackground(blob: Blob, color: string): Promise<Blob> {
  const bitmap = await loadBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); throw new Error('Canvas 2D context unavailable.'); }

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToBlob(canvas, blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg', 0.92);
}

/**
 * Advanced compression with adaptive quality and optional target file size.
 * Uses binary search over quality values to hit a target size.
 * Preserves format awareness and transparency.
 */
export async function rotateImage(blob: Blob, degrees: number): Promise<Blob> {
  const img = await createImageBitmap(blob);
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = Math.round(img.width * cos + img.height * sin);
  const h = Math.round(img.width * sin + img.height * cos);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.convertToBlob({ type: blob.type || "image/png" });
}

export async function flipImage(blob: Blob, direction: "horizontal" | "vertical"): Promise<Blob> {
  const img = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d")!;
  if (direction === "horizontal") {
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, img.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(img, 0, 0);
  return canvas.convertToBlob({ type: blob.type || "image/png" });
}

export async function compressImageAdvanced(
  blob: Blob,
  opts: CompressAdvancedOptions
): Promise<CompressAdvancedResult> {
  const info = await getImageInfo(blob);
  const sourceFormat = detectFormat(blob.type);
  const targetFormat = opts.format ?? sourceFormat;
  const hasAlpha = await hasTransparency(blob);

  // If target is PNG (lossless), compression via quality slider doesn't apply
  if (targetFormat === 'image/png') {
    const out = await convertImage(blob, 'image/png', 1);
    const outInfo = await getImageInfo(out);
    return { blob: out, width: outInfo.width, height: outInfo.height, size: outInfo.size, quality: 100, format: 'image/png' };
  }

  // If no target size, use the provided quality directly
  if (!opts.targetSizeKB) {
    const q = Math.min(1, Math.max(0, (opts.quality ?? 80) / 100));
    const out = await convertImage(blob, targetFormat, q);
    const outInfo = await getImageInfo(out);
    return { blob: out, width: outInfo.width, height: outInfo.height, size: outInfo.size, quality: Math.round(q * 100), format: targetFormat };
  }

  // Binary search for target file size
  const targetBytes = opts.targetSizeKB * 1024;
  let lo = opts.minQuality ?? 5;
  let hi = opts.maxQuality ?? 95;
  let bestBlob: Blob | null = null;
  let bestQuality = lo;
  let bestSize = Infinity;

  // If source is already smaller than target, just do a light pass
  if (blob.size <= targetBytes) {
    const q = Math.min(1, (opts.quality ?? 92) / 100);
    const out = await convertImage(blob, targetFormat, q);
    const outInfo = await getImageInfo(out);
    return { blob: out, width: outInfo.width, height: outInfo.height, size: outInfo.size, quality: Math.round(q * 100), format: targetFormat };
  }

  const MAX_ITERATIONS = 8;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = Math.round((lo + hi) / 2);
    const q = mid / 100;
    const out = await convertImage(blob, targetFormat, q);
    const outSize = out.size;

    // Track the closest result to target
    const diff = Math.abs(outSize - targetBytes);
    if (diff < Math.abs(bestSize - targetBytes)) {
      bestBlob = out;
      bestQuality = mid;
      bestSize = outSize;
    }

    if (outSize > targetBytes) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }

    // Close enough (within 5%)
    if (diff < targetBytes * 0.05) break;
  }

  if (!bestBlob) {
    // Fallback: compress at minimum quality
    const q = (opts.minQuality ?? 5) / 100;
    bestBlob = await convertImage(blob, targetFormat, q);
    bestQuality = opts.minQuality ?? 5;
    bestSize = bestBlob.size;
  }

  const outInfo = await getImageInfo(bestBlob);
  return { blob: bestBlob, width: outInfo.width, height: outInfo.height, size: outInfo.size, quality: bestQuality, format: targetFormat };
}
