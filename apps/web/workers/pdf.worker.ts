/**
 * PDF processing Web Worker.
 * Runs all pdf-lib operations (split, merge, delete, extract, rotate,
 * images→PDF, compress) off the main thread.
 */
import {
  splitPdf,
  mergePdfs,
  deletePages,
  extractPages,
  rotatePdf,
  imagesToPdf,
  compressPdf,
} from '@pdf-saas/pdf-engine'
import type {
  WorkerRequest,
  WorkerResponse,
  SplitPayload,
  DeletePagesPayload,
  ExtractPayload,
  RotatePayload,
  MergePayload,
  ImagesToPdfPayload,
  CompressPayload,
} from '@pdf-saas/shared'

const CHUNK = 0.8

function sendProgress(id: string, pct: number, label?: string) {
  const msg: WorkerResponse = { id, type: 'progress', data: { pct, label } }
  postMessage(msg)
}

function sendResult(id: string, data: unknown) {
  const msg: WorkerResponse = { id, type: 'result', data }
  postMessage(msg)
}

function sendError(id: string, message: string) {
  const msg: WorkerResponse = { id, type: 'error', data: message }
  postMessage(msg)
}

async function handle(ev: MessageEvent<WorkerRequest>) {
  const { id, operation, payload, signal } = ev.data
  if (signal === 'cancel') return

  try {
    switch (operation) {
      case 'split': {
        sendProgress(id, 20, 'Reading PDF…')
        const p = payload as SplitPayload
        const bytes = await splitPdf(p)
        sendProgress(id, CHUNK * 100, 'Splitting pages…')
        sendResult(id, { kind: 'pdf', bytes, mime: 'application/pdf' })
        break
      }
      case 'delete-pages': {
        sendProgress(id, 20, 'Reading PDF…')
        const p = payload as DeletePagesPayload
        const bytes = await deletePages(p)
        sendProgress(id, CHUNK * 100, 'Deleting pages…')
        sendResult(id, { kind: 'pdf', bytes, mime: 'application/pdf' })
        break
      }
      case 'extract': {
        sendProgress(id, 20, 'Reading PDF…')
        const p = payload as ExtractPayload
        const bytes = await extractPages(p)
        sendProgress(id, CHUNK * 100, 'Extracting pages…')
        sendResult(id, { kind: 'pdf', bytes, mime: 'application/pdf' })
        break
      }
      case 'rotate': {
        sendProgress(id, 20, 'Reading PDF…')
        const p = payload as RotatePayload
        const bytes = await rotatePdf(p)
        sendProgress(id, CHUNK * 100, 'Rotating pages…')
        sendResult(id, { kind: 'pdf', bytes, mime: 'application/pdf' })
        break
      }
      case 'merge': {
        const p = payload as MergePayload
        sendProgress(id, 10, `Merging ${p.files.length} files…`)
        const bytes = await mergePdfs(p)
        sendProgress(id, CHUNK * 100, 'Building merged PDF…')
        sendResult(id, { kind: 'pdf', bytes, mime: 'application/pdf' })
        break
      }
      case 'images-to-pdf': {
        const p = payload as ImagesToPdfPayload
        sendProgress(id, 15, 'Embedding images…')
        const bytes = await imagesToPdf(p)
        sendProgress(id, CHUNK * 100, 'Building PDF…')
        sendResult(id, { kind: 'pdf', bytes, mime: 'application/pdf' })
        break
      }
      case 'compress': {
        const p = payload as CompressPayload
        sendProgress(id, 25, 'Reading PDF…')
        const out = await compressPdf(p)
        sendProgress(id, CHUNK * 100, 'Optimizing…')
        sendResult(id, {
          kind: 'compress',
          bytes: out.data,
          originalSize: out.originalSize,
          compressedSize: out.compressedSize,
        })
        break
      }
      default:
        sendError(id, `Unknown pdf operation: ${operation}`)
    }
  } catch (err) {
    sendError(id, err instanceof Error ? err.message : String(err))
  }
}

self.addEventListener('message', (ev: MessageEvent<WorkerRequest>) => {
  void handle(ev)
})

export {}
