/**
 * @pdf-saas/file-utils
 * Pure, environment-agnostic file helpers shared by every tool.
 * No DOM/Node dependencies in the pure layer (only downloadBlob / blobToDataUrl).
 */

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = (bytes / Math.pow(k, i)).toFixed(decimals).replace(/\.0+$/, '');
  return `${value} ${units[i]}`;
}

export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-');
  return base || 'file';
}

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

export const MIME_TYPES = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
} as const;

export function mimeFromExtension(name: string): string {
  return MIME_TYPES[extensionOf(name) as keyof typeof MIME_TYPES] ?? 'application/octet-stream';
}

export function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/tiff': 'tif',
  };
  return map[mime] ?? 'bin';
}

/** 1-based page range parser: "2,5,7-10" -> [2,5,7,8,9,10]. Ignores invalid tokens. */
export function parsePageRanges(input: string, max?: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const m = token.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) {
      const a = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
      const b = Math.max(parseInt(m[1], 10), parseInt(m[2], 10));
      for (let i = a; i <= b; i++) {
        if (!max || i <= max) out.add(i);
      }
    } else if (/^\d+$/.test(token)) {
      const n = parseInt(token, 10);
      if (!max || n <= max) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export interface FileValidationError {
  index: number;
  name: string;
  reason: string;
}

export interface FileValidationOptions {
  /** Comma-separated MIME types, e.g. "application/pdf" or "image/jpeg,image/png" */
  accept?: string;
  extensions?: string[];
  maxSizeMB?: number;
  minCount?: number;
  maxCount?: number;
}

export interface FileValidationResult {
  valid: boolean;
  errors: FileValidationError[];
}

/**
 * Validates a file list against accept/extensions/size limits.
 * Uses both MIME type and extension so non-standards-compliant uploads
 * (e.g. `application/octet-stream`) still pass when they are real PDFs.
 */
export function validateFiles(
  files: File[],
  opts: FileValidationOptions = {}
): FileValidationResult {
  const errors: FileValidationError[] = [];
  const allowedMimes = (opts.accept ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const allowedExts = (opts.extensions ?? []).map((e) => e.toLowerCase().replace(/^\./, ''));

  if (opts.minCount && files.length < opts.minCount) {
    return {
      valid: false,
      errors: [{ index: -1, name: '', reason: `Select at least ${opts.minCount} file(s).` }],
    };
  }
  if (opts.maxCount && files.length > opts.maxCount) {
    return {
      valid: false,
      errors: [{ index: -1, name: '', reason: `At most ${opts.maxCount} files are supported.` }],
    };
  }

  files.forEach((file, i) => {
    const ext = extensionOf(file.name);
    const mime = file.type.toLowerCase();
    const typeOk =
      allowedMimes.length === 0 ||
      allowedMimes.includes('*') ||
      allowedMimes.includes(mime) ||
      (allowedMimes.includes('application/pdf') && mime === 'application/octet-stream' && ext === 'pdf');
    const extOk = allowedExts.length === 0 || allowedExts.includes(ext);
    if (!typeOk || !extOk) {
      errors.push({
        index: i,
        name: file.name,
        reason: `Unsupported file type${ext ? ` (${ext})` : ''}. Accepted: ${opts.accept ?? 'any'}`,
      });
    } else if (opts.maxSizeMB && file.size > opts.maxSizeMB * 1024 * 1024) {
      errors.push({
        index: i,
        name: file.name,
        reason: `File exceeds ${opts.maxSizeMB} MB limit (${formatBytes(file.size)}).`,
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* Browser-only helpers (guarded)                                      */
/* ------------------------------------------------------------------ */

export async function fileToUint8Array(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Triggers a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof URL === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function arrayBufferToBlob(bytes: ArrayBuffer | Uint8Array, mime: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: mime });
}
