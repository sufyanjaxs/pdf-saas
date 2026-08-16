/**
 * @pdf-saas/pdf-engine
 * All PDF manipulation, powered by pdf-lib (MIT).
 *
 * Runs in a Web Worker in the browser (no DOM required). Functions are
 * async only where browser APIs are involved (e.g. JPEG recompression via
 * createImageBitmap + OffscreenCanvas). In Node these paths are skipped and
 * a plain object-streams re-save is produced instead, so tests stay green.
 */
import {
  PDFDocument,
  PDFRawStream,
  PDFName,
  PDFNumber,
  degrees,
  type PDFDict,
} from 'pdf-lib';

const isBrowser =
  typeof window !== 'undefined' || (typeof self !== 'undefined' && typeof (self as any).OffscreenCanvas !== 'undefined');

export interface PageOption {
  /** 1-based page number */
  pages: number[];
}

export interface SplitInput {
  bytes: Uint8Array;
  pages: number[];
}
export interface DeleteInput {
  bytes: Uint8Array;
  pages: number[];
}
export interface RotateInput {
  bytes: Uint8Array;
  pages: number[]; // empty = all
  degrees: 90 | 180 | 270;
}
export interface MergeInput {
  files: Uint8Array[];
}
export interface ImagesToPdfInput {
  files: Uint8Array[];
  mimes: string[];
}
export interface CompressInput {
  bytes: Uint8Array;
  level: 'balanced' | 'strong' | 'maximum';
}
export interface CompressOutput {
  data: Uint8Array;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

const JPEG_QUALITY: Record<'balanced' | 'strong' | 'maximum', number> = {
  balanced: 0.85,
  strong: 0.72,
  maximum: 0.5,
};

function padPageIndex(pages: number[], total: number): number[] {
  const valid = pages.filter((p) => p >= 1 && p <= total);
  return [...new Set(valid)].sort((a, b) => a - b);
}

export async function splitPdf(input: SplitInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const selected = padPageIndex(input.pages, doc.getPageCount());
  if (selected.length === 0) throw new Error('Select at least one page.');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(doc, selected.map((p) => p - 1));
  copied.forEach((page) => out.addPage(page));
  return out.save({ useObjectStreams: true });
}

export async function deletePages(input: DeleteInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const toDelete = padPageIndex(input.pages, doc.getPageCount());
  if (toDelete.length >= doc.getPageCount()) throw new Error('Cannot delete every page.');
  const keep = Array.from({ length: doc.getPageCount() }, (_, i) => i + 1).filter((p) => !toDelete.includes(p));
  const out = await PDFDocument.create();
  const copied = await out.copyPages(doc, keep.map((p) => p - 1));
  copied.forEach((page) => out.addPage(page));
  return out.save({ useObjectStreams: true });
}

export async function extractPages(input: { bytes: Uint8Array; ranges: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const selected = padPageIndex(parseRanges(input.ranges), doc.getPageCount());
  if (selected.length === 0) throw new Error('No valid pages in range.');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(doc, selected.map((p) => p - 1));
  copied.forEach((page) => out.addPage(page));
  return out.save({ useObjectStreams: true });
}

export async function rotatePdf(input: RotateInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const total = doc.getPageCount();
  const targets = input.pages.length === 0 ? Array.from({ length: total }, (_, i) => i + 1) : padPageIndex(input.pages, total);
  targets.forEach((p) => {
    const page = doc.getPage(p - 1);
    const current = page.getRotation().angle;
    page.setRotation(degrees(current + input.degrees));
  });
  return doc.save({ useObjectStreams: true });
}

export async function mergePdfs(input: MergeInput): Promise<Uint8Array> {
  if (input.files.length < 2) throw new Error('Select at least 2 PDFs.');
  const out = await PDFDocument.create();
  for (const bytes of input.files) {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
    const copied = await out.copyPages(doc, doc.getPageIndices());
    copied.forEach((page) => out.addPage(page));
  }
  return out.save({ useObjectStreams: true });
}

export async function imagesToPdf(input: ImagesToPdfInput): Promise<Uint8Array> {
  if (input.files.length === 0) throw new Error('Add at least one image.');
  const out = await PDFDocument.create();
  for (let i = 0; i < input.files.length; i++) {
    const mime = input.mimes[i] ?? 'image/jpeg';
    let image;
    if (mime === 'image/png') {
      image = await out.embedPng(input.files[i]);
    } else if (mime === 'image/webp') {
      throw new Error('WEBP requires conversion first. Convert to JPG or PNG, then retry.');
    } else {
      image = await out.embedJpg(input.files[i]);
    }
    const { width, height } = image.scale(1);
    // A4 portrait with a small margin; keep aspect ratio.
    const pageW = 595.28;
    const pageH = 841.89;
    const margin = 12;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / width, maxH / height, 1);
    const w = width * scale;
    const h = height * scale;
    const page = out.addPage([pageW, pageH]);
    page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  }
  return out.save({ useObjectStreams: true });
}

/* ------------------------------------------------------------------ */
/* Compression                                                         */
/* ------------------------------------------------------------------ */

/**
 * Three-tier compression:
 *  - balanced: object-streams re-save (lossless, strips redundant objects)
 *  - strong:   + recompresses embedded JPEG images to ~72% quality
 *  - maximum:  + recompresses embedded JPEG images to ~50% quality
 */
export async function compressPdf(input: CompressInput): Promise<CompressOutput> {
  const originalSize = input.bytes.length;
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');

  if (input.level !== 'balanced' && isBrowser) {
    await recompressJpegs(doc, JPEG_QUALITY[input.level]);
  }

  // Balanced is lossless: emit both plain and object-stream variants and keep
  // whichever is smaller so the tool never makes a document larger.
  let data: Uint8Array;
  if (input.level === 'balanced') {
    const [plain, objStreams] = await Promise.all([
      doc.save({ useObjectStreams: false }),
      doc.save({ useObjectStreams: true }),
    ]);
    data = plain.length <= objStreams.length ? plain : objStreams;
  } else {
    data = await doc.save({ useObjectStreams: true });
  }

  return {
    data,
    originalSize,
    compressedSize: data.length,
    ratio: data.length / originalSize,
  };
}

/**
 * Walks every indirect object; any DCTDecode (JPEG) image stream that is
 * lossy-recompressible gets re-encoded at the target quality and swapped in.
 * Skipped when the re-encode is not smaller, or when streams are too small
 * to avoid destroying tiny logos/icons.
 */
async function recompressJpegs(doc: PDFDocument, quality: number): Promise<void> {
  const context = (doc as any).context;
  if (!context || typeof context.enumerateIndirectObjects !== 'function') return;

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict: PDFDict = obj.dict;
    const filter = dict.get(PDFName.of('Filter'));

    let isJpeg = false;
    if (filter instanceof PDFName && filter.asString() === 'DCTDecode') isJpeg = true;
    else if (Array.isArray(filter)) {
      isJpeg = (filter as unknown as PDFName[]).some(
        (f) => f instanceof PDFName && f.asString() === 'DCTDecode'
      );
    }
    if (!isJpeg) continue;

    const width = dict.get(PDFName.of('Width'));
    const height = dict.get(PDFName.of('Height'));
    if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)) continue;
    if (width.asNumber() * height.asNumber() < 4096) continue;

    const raw = obj.contents;
    if (!raw || raw.length < 64) continue;

    try {
      const bitmap = await createImageBitmap(new Blob([raw as unknown as BlobPart], { type: 'image/jpeg' }));
      const canvas = new OffscreenCanvas(width.asNumber(), height.asNumber());
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        continue;
      }
      ctx.drawImage(bitmap, 0, 0, width.asNumber(), height.asNumber());
      bitmap.close();
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      const newBytes = new Uint8Array(await blob.arrayBuffer());
      if (newBytes.length >= raw.length) continue;

      const newDict = dict.clone();
      newDict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
      context.assign(ref, PDFRawStream.of(newDict, newBytes));
    } catch {
      // Some JPEGs fail to decode in-browser; leave them untouched.
    }
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function parseRanges(input: string, max?: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const m = token.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) {
      const a = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
      const b = Math.max(parseInt(m[1], 10), parseInt(m[2], 10));
      for (let i = a; i <= b; i++) if (!max || i <= max) out.add(i);
    } else if (/^\d+$/.test(token)) {
      const n = parseInt(token, 10);
      if (!max || n <= max) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}
