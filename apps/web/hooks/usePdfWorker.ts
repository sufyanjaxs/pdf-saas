'use client'

import { useWorker } from './useWorker'

export type PdfWorkerResult =
  | { kind: 'pdf'; bytes: Uint8Array; mime: 'application/pdf' }
  | { kind: 'compress'; bytes: Uint8Array; originalSize: number; compressedSize: number }

/**
 * PDF worker hook. The worker URL literal lives here so webpack can statically
 * analyze it; all pdf-lib heavy operations run off the main thread.
 */
export function usePdfWorker() {
  return useWorker<PdfWorkerResult>(() => new Worker(new URL('../workers/pdf.worker', import.meta.url)))
}
