/**
 * Image processing Web Worker.
 * Runs resize / crop / compress / convert via OffscreenCanvas so heavy pixel
 * work never blocks the main thread.
 */
import {
  resizeImage,
  cropImage,
  convertImage,
  compressImage,
  getImageInfo,
  formatToExtension,
  type ImageFormat,
} from '@pdf-saas/image-engine'
import { base64ToUint8, uint8ToBase64 } from '@pdf-saas/file-utils'
import type {
  WorkerRequest,
  WorkerResponse,
  ImageBlobPayload,
  ResizePayload,
  CompressImagePayload,
  CropPayload,
} from '@pdf-saas/shared'

const CHUNK = 0.85

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

function payloadToBlob(p: ImageBlobPayload): Blob {
  return new Blob([base64ToUint8(p.bytes) as unknown as BlobPart], { type: p.mime || 'application/octet-stream' })
}

async function processOne(
  operation: string,
  blobPayload: ImageBlobPayload,
  opts: ResizePayload | CompressImagePayload | CropPayload | undefined,
  outputName: string,
): Promise<{ mime: string; bytes: string; width: number; height: number; size: number; name: string }> {
  const input = payloadToBlob(blobPayload)
  const info = await getImageInfo(input)
  let out: Blob

  if (operation === 'resize') {
    const o = opts as ResizePayload
    out = await resizeImage(input, { width: o.width, height: o.height, fit: o.fit })
  } else if (operation === 'crop') {
    const o = opts as CropPayload
    out = await cropImage(input, { x: o.x, y: o.y, width: o.width, height: o.height })
  } else if (operation === 'convert') {
    const o = opts as CompressImagePayload
    out = await convertImage(input, o.format as ImageFormat, o.quality ?? 0.9)
  } else if (operation === 'compress') {
    const o = opts as CompressImagePayload
    out = await compressImage(input, o.quality, o.format as ImageFormat)
  } else {
    throw new Error(`Unknown image operation: ${operation}`)
  }

  const outInfo = await getImageInfo(out)
  const ext = formatToExtension(out.type as ImageFormat)
  const dot = outputName.lastIndexOf('.')
  const base = dot === -1 ? outputName : outputName.slice(0, dot)
  const arr = new Uint8Array(await out.arrayBuffer())

  return {
    mime: out.type,
    bytes: uint8ToBase64(arr),
    width: outInfo.width,
    height: outInfo.height,
    size: arr.length,
    name: `${base}.${ext}`,
  }
}

async function handle(ev: MessageEvent<WorkerRequest>) {
  const { id, operation, payload, signal } = ev.data
  if (signal === 'cancel') return

  try {
    if (operation === 'info') {
      const p = payload as { files: ImageBlobPayload[] }
      const infos = []
      for (let i = 0; i < p.files.length; i++) {
        const info = await getImageInfo(payloadToBlob(p.files[i]))
        infos.push({ ...info, name: p.files[i].name })
        sendProgress(id, ((i + 1) / p.files.length) * 100, `Reading image ${i + 1}/${p.files.length}`)
      }
      sendResult(id, infos)
      return
    }

    const p = payload as { files: ImageBlobPayload[]; opts?: unknown }
    const files = p.files ?? []
    if (files.length === 0) throw new Error('No files to process.')

    const results = []
    for (let i = 0; i < files.length; i++) {
      sendProgress(
        id,
        ((i + CHUNK) / files.length) * 100,
        `Processing ${i + 1}/${files.length}`,
      )
      const r = await processOne(
        operation,
        files[i],
        p.opts as ResizePayload | CompressImagePayload | CropPayload | undefined,
        files[i].name,
      )
      results.push(r)
    }
    sendResult(id, results)
  } catch (err) {
    sendError(id, err instanceof Error ? err.message : String(err))
  }
}

self.addEventListener('message', (ev: MessageEvent<WorkerRequest>) => {
  void handle(ev)
})

export {}
