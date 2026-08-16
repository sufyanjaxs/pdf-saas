'use client'

import { useWorker } from './useWorker'

export interface ImageWorkerResult {
  name: string
  mime: string
  /** base64-encoded bytes */
  bytes: string
  width: number
  height: number
  size: number
}

/**
 * Image worker hook — canvas processing (resize/crop/compress/convert) runs in
 * a Web Worker using OffscreenCanvas, keeping the main thread free.
 */
export function useImageWorker() {
  return useWorker<ImageWorkerResult[]>(() => new Worker(new URL('../workers/image.worker', import.meta.url)))
}
