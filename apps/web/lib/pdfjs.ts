'use client'

/**
 * Main-thread pdf.js helpers: page thumbnails and PDF→JPG export.
 * pdf.js offloads parsing to its own dedicated Web Worker; rendering is
 * async and chunked, so the UI stays responsive.
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'

let configured = false

function ensurePdfJs() {
  if (configured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/pdf.worker.min.js`
  configured = true
}

export interface RenderedPage {
  pageNumber: number
  dataUrl: string
  width: number
  height: number
}

export async function loadPdfDocument(bytes: ArrayBuffer | Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  ensurePdfJs()
  const task = pdfjsLib.getDocument({ data: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes) })
  return task.promise
}

/**
 * Renders a set of pages as thumbnail data-URLs.
 */
export async function renderThumbnails(
  bytes: ArrayBuffer | Uint8Array,
  targetWidth = 160,
): Promise<RenderedPage[]> {
  const doc = await loadPdfDocument(bytes)
  const out: RenderedPage[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const scale = targetWidth / base.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    await page.render({ canvasContext: ctx, viewport }).promise
    out.push({ pageNumber: n, dataUrl: canvas.toDataURL('image/jpeg', 0.6), width: canvas.width, height: canvas.height })
  }
  return out
}

export interface PdfToJpgOptions {
  pages: number[]
  scale?: number
  quality?: number
  onProgress?: (pct: number) => void
}

export interface PdfToJpgOutput {
  pageNumber: number
  blob: Blob
}

export async function pdfToJpeg(
  bytes: ArrayBuffer | Uint8Array,
  opts: PdfToJpgOptions,
): Promise<PdfToJpgOutput[]> {
  const doc = await loadPdfDocument(bytes)
  const scale = opts.scale ?? 2
  const quality = opts.quality ?? 0.92
  const outputs: PdfToJpgOutput[] = []

  for (let i = 0; i < opts.pages.length; i++) {
    const n = opts.pages[i]
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    const renderTask = page.render({ canvasContext: ctx, viewport })
    await renderTask.promise
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', quality))
    outputs.push({ pageNumber: n, blob })
    opts.onProgress?.(((i + 1) / opts.pages.length) * 100)
  }
  return outputs
}
