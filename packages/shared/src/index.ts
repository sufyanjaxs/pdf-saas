export type WorkerSignal = 'start' | 'cancel';

export interface WorkerRequest<T = unknown> {
  id: string;
  signal?: WorkerSignal;
  operation: string;
  payload: T;
}

export interface WorkerProgress {
  pct: number;
  label?: string;
}

export type WorkerResponse =
  | { id: string; type: 'progress'; data: WorkerProgress }
  | { id: string; type: 'result'; data: unknown }
  | { id: string; type: 'error'; data: string };

export interface ResultBlob {
  name: string;
  mime: string;
  bytes: number;
}

/** Result envelope for every tool worker operation. */
export interface ToolResult<T = unknown> {
  ok: true;
  data: T;
  blobs: ResultBlob[];
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* PDF operations                                                      */
/* ------------------------------------------------------------------ */

export interface PdfBytesPayload {
  bytes: Uint8Array;
  fileCount: number;
  fileIndex: number;
}

export interface PdfFilePayload {
  /** base64-encoded bytes (transfer-safe) */
  files: string[];
}

export interface SplitPayload {
  bytes: Uint8Array;
  /** 1-based page numbers to keep */
  pages: number[];
}

export interface DeletePagesPayload {
  bytes: Uint8Array;
  /** 1-based page numbers to delete */
  pages: number[];
}

export interface ExtractPayload {
  bytes: Uint8Array;
  /** raw range string e.g. "2,5,7-10" */
  ranges: string;
}

export interface RotatePayload {
  bytes: Uint8Array;
  /** 1-based page numbers, or empty = all pages */
  pages: number[];
  degrees: 90 | 180 | 270;
}

export interface MergePayload {
  files: Uint8Array[];
}

export interface ImagesToPdfPayload {
  files: Uint8Array[];
  mimes: string[];
}

export interface CompressPayload {
  bytes: Uint8Array;
  level: 'balanced' | 'strong' | 'maximum';
}

export interface CompressResult {
  data: Uint8Array;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

export interface PdfToJpgPayload {
  bytes: Uint8Array;
  /** 1-based page numbers */
  pages: number[];
  scale: number;
  quality: number;
}

/* ------------------------------------------------------------------ */
/* Image operations                                                    */
/* ------------------------------------------------------------------ */

export interface ImageBlobPayload {
  /** base64-encoded file bytes */
  bytes: string;
  mime: string;
  name: string;
  quality?: number;
}

export interface ResizePayload {
  blob: ImageBlobPayload;
  width?: number;
  height?: number;
  fit: 'cover' | 'contain' | 'stretch';
}

export interface CompressImagePayload {
  blob: ImageBlobPayload;
  quality: number;
  format: 'image/jpeg' | 'image/webp' | 'image/png';
}

export interface CropPayload {
  blob: ImageBlobPayload;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageResult {
  mime: string;
  /** base64-encoded output bytes */
  bytes: string;
  width: number;
  height: number;
  size: number;
}

/* ------------------------------------------------------------------ */
/* Tool registry metadata                                              */
/* ------------------------------------------------------------------ */

export type ToolCategory = 'PDF' | 'Image';

export interface ToolMeta {
  slug: string;
  name: string;
  shortName: string;
  category: ToolCategory;
  description: string;
  icon: string;
  keywords: string[];
}
