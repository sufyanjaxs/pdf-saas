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
  PDFArray,
  StandardFonts,
  degrees,
  rgb,
  type PDFDict,
} from '@cantoo/pdf-lib';

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
  pageSize?: [number, number];
  orientation?: 'auto' | 'portrait' | 'landscape';
  margin?: number;
  fitMode?: 'contain' | 'fill';
}
export interface CompressInput {
  bytes: Uint8Array;
  level: 'balanced' | 'strong' | 'maximum';
}
export interface ReorderInput {
  bytes: Uint8Array;
  order: number[];
}
export interface ProtectInput {
  bytes: Uint8Array;
  password: string;
}
export interface UnlockInput {
  bytes: Uint8Array;
  password?: string;
}
export interface WatermarkInput {
  bytes: Uint8Array;
  text: string;
  opacity: number;
  size: number;
}
export interface PageNumbersInput {
  bytes: Uint8Array;
  position: 'bottom-right' | 'bottom-center' | 'top-right' | 'top-center';
  format: string;
}
export interface PdfCropInput {
  bytes: Uint8Array;
  margins: { top: number; right: number; bottom: number; left: number };
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

export async function rotatePdf(input: RotateInput & { rotations?: Record<string | number, number> }): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const total = doc.getPageCount();
  if (input.rotations && Object.keys(input.rotations).length > 0) {
    // Per-page absolute angles (0/90/180/270) as sent by the visual editor.
    for (const [key, angle] of Object.entries(input.rotations)) {
      const p = Number(key);
      if (!Number.isInteger(p) || p < 1 || p > total) continue;
      const page = doc.getPage(p - 1);
      if (typeof angle === 'number' && Number.isFinite(angle)) {
        page.setRotation(degrees(((angle % 360) + 360) % 360));
      }
    }
    return doc.save({ useObjectStreams: true });
  }
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

export async function reorderPdf(input: ReorderInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const total = doc.getPageCount();
  const order = input.order
    .filter((p) => p >= 1 && p <= total)
    .filter((p, i, arr) => arr.indexOf(p) === i);
  if (order.length === 0) throw new Error('Pick at least one page.');
  const out = await PDFDocument.create();
  const copied = await out.copyPages(doc, order.map((p) => p - 1));
  copied.forEach((page) => out.addPage(page));
  return out.save({ useObjectStreams: true });
}

export async function protectPdf(input: ProtectInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  const password = input.password.trim();
  if (password.length < 4) throw new Error('Password must be at least 4 characters.');
  doc.encrypt({
    userPassword: password,
    ownerPassword: password,
    permissions: {
      printing: 'highResolution',
      modifying: true,
      copying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true,
    },
  });
  return doc.save({ useObjectStreams: true, rewrite: true });
}

export async function unlockPdf(input: UnlockInput): Promise<Uint8Array> {
  const doc = input.password
    ? await PDFDocument.load(input.bytes, { password: input.password, ignoreEncryption: false })
    : await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('A password is required to open this PDF.');
  // The fork keeps /Encrypt trailer entries and the original trailer object after
  // decrypting, so re-saving the loaded document stays encrypted. Rebuild the
  // document from scratch via copyPages to produce a genuinely unencrypted PDF.
  const fresh = await PDFDocument.create();
  const copied = await fresh.copyPages(doc, doc.getPageIndices());
  copied.forEach((page) => fresh.addPage(page));
  return fresh.save({ useObjectStreams: true });
}

export async function watermarkPdf(input: WatermarkInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const text = input.text.trim();
  if (!text) throw new Error('Enter watermark text.');
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const opacity = Math.min(Math.max(input.opacity, 0.05), 0.6);
  const size = Math.min(Math.max(input.size, 10), 96);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const stepX = size * 12;
    const stepY = size * 5;
    for (let x = -width; x < width + stepX; x += stepX) {
      for (let y = -height; y < height + stepY; y += stepY) {
        page.drawText(text, {
          x,
          y,
          size,
          font,
          rotate: degrees(-35),
          opacity,
          color: rgb(0.3, 0.3, 0.35),
        });
      }
    }
  }
  return doc.save({ useObjectStreams: true });
}

export async function addPageNumbers(input: PageNumbersInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();
  const format = input.format || 'Page {n} of {total}';
  const pos = input.position ?? 'bottom-right';
  const size = 10;

  doc.getPages().forEach((page, i) => {
    const { width, height } = page.getSize();
    const label = format.replace('{n}', String(i + 1)).replace('{total}', String(total));
    const textWidth = font.widthOfTextAtSize(label, size);
    const margin = 36;
    let x: number;
    let y: number;
    if (pos === 'bottom-right') {
      x = width - margin - textWidth;
      y = margin - size;
    } else if (pos === 'bottom-center') {
      x = (width - textWidth) / 2;
      y = margin - size;
    } else if (pos === 'top-right') {
      x = width - margin - textWidth;
      y = height - margin;
    } else {
      x = (width - textWidth) / 2;
      y = height - margin;
    }
    page.drawText(label, { x, y, size, font, color: rgb(0.2, 0.2, 0.25) });
  });
  return doc.save({ useObjectStreams: true });
}

export async function cropPdf(input: PdfCropInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: false });
  if (doc.isEncrypted) throw new Error('Encrypted PDFs are not supported.');
  const m = input.margins;
  const clamp = (v: number) => Math.min(Math.max(v, 0), 49);
  const top = clamp(m.top);
  const right = clamp(m.right);
  const bottom = clamp(m.bottom);
  const left = clamp(m.left);
  if (top + bottom >= 99 || left + right >= 99) throw new Error('Margins are too large.');

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const x = (width * left) / 100;
    const y = (height * bottom) / 100;
    const w = width - (width * (left + right)) / 100;
    const h = height - (height * (top + bottom)) / 100;
    page.setCropBox(x, y, w, h);
  }
  return doc.save({ useObjectStreams: true });
}

export async function textToPdf(input: { text: string; pageSize?: [number, number] }): Promise<Uint8Array> {
  const text = input.text ?? '';
  const pageSize = input.pageSize ?? [595.28, 841.89];
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 56;
  const lineHeight = fontSize * 1.45;
  const usableWidth = pageSize[0] - margin * 2;
  const maxLinesPerPage = Math.floor((pageSize[1] - margin * 2) / lineHeight);

  const paragraphs = text.split(/\r?\n/);

  const wrap = (line: string): string[] => {
    if (line.trim().length === 0) return [''];
    const words = line.split(/\s+/);
    const out: string[] = [];
    let cur = '';
    for (const word of words) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= usableWidth) {
        cur = candidate;
      } else {
        if (cur) out.push(cur);
        cur = word;
      }
    }
    if (cur) out.push(cur);
    return out;
  };

  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;
  let used = 0;

  for (const line of paragraphs) {
    for (const piece of wrap(line)) {
      if (used >= maxLinesPerPage) {
        page = doc.addPage(pageSize);
        y = pageSize[1] - margin;
        used = 0;
      }
      if (piece.length > 0) {
        page.drawText(piece, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.12) });
      }
      y -= lineHeight;
      used += 1;
    }
  }
  return doc.save({ useObjectStreams: true });
}

export async function imagesToPdf(input: ImagesToPdfInput): Promise<Uint8Array> {
  if (input.files.length === 0) throw new Error('Add at least one image.');
  const out = await PDFDocument.create();
  const baseMargin = input.margin ?? 12;
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
    let pageW: number;
    let pageH: number;
    if (input.pageSize) {
      pageW = input.pageSize[0];
      pageH = input.pageSize[1];
      if (input.orientation === 'portrait') { pageW = Math.min(pageW, pageH); pageH = Math.max(input.pageSize[0], input.pageSize[1]); }
      else if (input.orientation === 'landscape') { pageW = Math.max(pageW, pageH); pageH = Math.min(input.pageSize[0], input.pageSize[1]); }
      else { if (width > height) { pageW = Math.max(pageW, pageH); pageH = Math.min(input.pageSize[0], input.pageSize[1]); } }
    } else {
      pageW = width + baseMargin * 2;
      pageH = height + baseMargin * 2;
    }
    const maxW = pageW - baseMargin * 2;
    const maxH = pageH - baseMargin * 2;
    const scale = input.fitMode === 'fill' ? Math.max(maxW / width, maxH / height) : Math.min(maxW / width, maxH / height, 1);
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
      doc.save({ useObjectStreams: false, rewrite: true }),
      doc.save({ useObjectStreams: true, rewrite: true }),
    ]);
    const candidates = [input.bytes, plain, objStreams];
    data = candidates.reduce((a, b) => (b.length < a.length ? b : a));
  } else {
    data = await doc.save({ useObjectStreams: true, rewrite: true });
  }

  return {
    data,
    originalSize,
    compressedSize: data.length,
    ratio: data.length / originalSize,
  };
}

/**
 * True when a stream's /Filter entry (a name or an array of names) includes
 * DCTDecode, i.e. the stream is JPEG-encoded.
 *
 * NOTE: PDFName.asString() returns the ENCODED name including the leading
 * slash ('/DCTDecode'). Comparing against 'DCTDecode' never matches — this was
 * a real bug that silently disabled Strong/Maximum compression. PDFName.of()
 * returns pooled instances, so identity comparison also works; we use both
 * checks for clarity. Exported for regression tests.
 */
export function filterIsJpeg(filter: unknown): boolean {
  if (filter instanceof PDFName) {
    return filter === PDFName.of('DCTDecode') || filter.asString() === '/DCTDecode';
  }
  if (filter instanceof PDFArray) {
    for (let i = 0; i < filter.size(); i++) {
      const f = filter.get(i);
      if (f instanceof PDFName && (f === PDFName.of('DCTDecode') || f.asString() === '/DCTDecode')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Walks every indirect object; any DCTDecode (JPEG) image stream that is
 * lossy-recompressible gets re-encoded at the target quality and swapped in.
 * Skipped when the re-encode is not smaller, or when streams are too small
 * to avoid destroying tiny logos/icons.
 *
 * `reencode` is injectable so the walk/detect/swap logic can be regression-
 * tested in Node without canvas APIs.
 */
export async function recompressJpegs(
  doc: PDFDocument,
  quality: number,
  reencode?: (jpegBytes: Uint8Array, width: number, height: number, quality: number) => Promise<Uint8Array | null>,
): Promise<void> {
  const context = (doc as any).context;
  if (!context || typeof context.enumerateIndirectObjects !== 'function') return;

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict: PDFDict = obj.dict;
    if (!filterIsJpeg(dict.get(PDFName.of('Filter')))) continue;

    const width = dict.get(PDFName.of('Width'));
    const height = dict.get(PDFName.of('Height'));
    if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)) continue;
    if (width.asNumber() * height.asNumber() < 4096) continue;

    const raw = obj.contents;
    if (!raw || raw.length < 64) continue;

    try {
      let newBytes: Uint8Array | null;
      if (reencode) {
        newBytes = await reencode(raw, width.asNumber(), height.asNumber(), quality);
      } else {
        if (!isBrowser) continue;
        newBytes = await reencodeInBrowser(raw, width.asNumber(), height.asNumber(), quality);
      }
      if (!newBytes || newBytes.length >= raw.length) continue;

      const newDict = dict.clone();
      newDict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
      context.assign(ref, PDFRawStream.of(newDict, newBytes));
    } catch {
      // Some JPEGs fail to decode in-browser; leave them untouched.
    }
  }
}

async function reencodeInBrowser(
  raw: Uint8Array,
  width: number,
  height: number,
  quality: number,
): Promise<Uint8Array | null> {
  const bitmap = await createImageBitmap(new Blob([raw as unknown as BlobPart], { type: 'image/jpeg' }));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return new Uint8Array(await blob.arrayBuffer());
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
