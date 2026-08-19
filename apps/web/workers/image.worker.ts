/**
 * Image processing Web Worker.
 * Runs resize / crop / compress / convert / analyze via OffscreenCanvas
 * so heavy pixel work never blocks the main thread.
 */
import {
  resizeImage,
  cropImage,
  convertImage,
  compressImage,
  compressImageAdvanced,
  analyzeImage,
  circleCrop,
  circleCropWithBackground,
  fillBackground,
  rotateImage,
  flipImage,
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
  CompressAdvancedPayload,
  AnalyzePayload,
  CircleCropPayload,
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
      const p = payload as AnalyzePayload
      const infos = []
      for (let i = 0; i < p.files.length; i++) {
        const info = await getImageInfo(payloadToBlob(p.files[i]))
        infos.push({ ...info, name: p.files[i].name })
        sendProgress(id, ((i + 1) / p.files.length) * 100, `Reading image ${i + 1}/${p.files.length}`)
      }
      sendResult(id, infos)
      return
    }

    if (operation === 'analyze') {
      const p = payload as AnalyzePayload
      const analyses = []
      for (let i = 0; i < p.files.length; i++) {
        const analysis = await analyzeImage(payloadToBlob(p.files[i]))
        analyses.push({ ...analysis, name: p.files[i].name })
        sendProgress(id, ((i + 1) / p.files.length) * 100, `Analyzing image ${i + 1}/${p.files.length}`)
      }
      sendResult(id, analyses)
      return
    }

    if (operation === 'compress-advanced') {
      const p = payload as CompressAdvancedPayload
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Compressing ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const res = await compressImageAdvanced(input, {
          format: p.opts.format ?? undefined,
          quality: p.opts.quality,
          targetSizeKB: p.opts.targetSizeKB,
          minQuality: p.opts.minQuality,
          maxQuality: p.opts.maxQuality,
        })
        const arr = new Uint8Array(await res.blob.arrayBuffer())
        const ext = formatToExtension(res.format)
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({
          mime: res.blob.type,
          bytes: uint8ToBase64(arr),
          width: res.width,
          height: res.height,
          size: arr.length,
          name: `${base}.${ext}`,
          quality: res.quality,
        })
      }
      sendResult(id, results)
      return
    }

    if (operation === 'circle-crop') {
      const p = payload as CircleCropPayload
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Processing ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        let out: Blob
        if (p.opts.bgColor) {
          out = await circleCropWithBackground(input, p.opts.bgColor, p.opts.borderWidth ?? 0, p.opts.borderColor ?? '#ffffff')
        } else {
          out = await circleCrop(input)
        }
        const outInfo = await getImageInfo(out)
        const arr = new Uint8Array(await out.arrayBuffer())
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({
          mime: 'image/png',
          bytes: uint8ToBase64(arr),
          width: outInfo.width,
          height: outInfo.height,
          size: arr.length,
          name: `${base}-circle.png`,
        })
      }
      sendResult(id, results)
      return
    }

    if (operation === 'fill-background') {
      const p = payload as { files: ImageBlobPayload[]; opts: { color: string } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Processing ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const out = await fillBackground(input, p.opts.color)
        const outInfo = await getImageInfo(out)
        const arr = new Uint8Array(await out.arrayBuffer())
        const ext = formatToExtension(out.type as ImageFormat)
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({
          mime: out.type,
          bytes: uint8ToBase64(arr),
          width: outInfo.width,
          height: outInfo.height,
          size: arr.length,
          name: `${base}.${ext}`,
        })
      }
      sendResult(id, results)
      return
    }

    if (operation === 'rotate') {
      const p = payload as { files: ImageBlobPayload[]; opts: { degrees: number } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Rotating ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const out = await rotateImage(input, p.opts.degrees)
        const outInfo = await getImageInfo(out)
        const arr = new Uint8Array(await out.arrayBuffer())
        const ext = formatToExtension(out.type as ImageFormat)
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({
          mime: out.type,
          bytes: uint8ToBase64(arr),
          width: outInfo.width,
          height: outInfo.height,
          size: arr.length,
          name: `${base}-rotated.${ext}`,
        })
      }
      sendResult(id, results)
      return
    }

    if (operation === 'flip') {
      const p = payload as { files: ImageBlobPayload[]; opts: { direction: 'horizontal' | 'vertical' } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Flipping ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const out = await flipImage(input, p.opts.direction)
        const outInfo = await getImageInfo(out)
        const arr = new Uint8Array(await out.arrayBuffer())
        const ext = formatToExtension(out.type as ImageFormat)
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({
          mime: out.type,
          bytes: uint8ToBase64(arr),
          width: outInfo.width,
          height: outInfo.height,
          size: arr.length,
          name: `${base}-flipped.${ext}`,
        })
      }
      sendResult(id, results)
      return
    }

    if (operation === 'grayscale') {
      const p = payload as { files: ImageBlobPayload[]; opts?: { intensity?: number } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Converting ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const bmp = await createImageBitmap(input)
        const canvas = new OffscreenCanvas(bmp.width, bmp.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height)
        const intensity = p.opts?.intensity ?? 100
        const factor = intensity / 100
        for (let j = 0; j < imgData.data.length; j += 4) {
          const gray = imgData.data[j] * 0.299 + imgData.data[j + 1] * 0.587 + imgData.data[j + 2] * 0.114
          imgData.data[j] = Math.round(imgData.data[j] * (1 - factor) + gray * factor)
          imgData.data[j + 1] = Math.round(imgData.data[j + 1] * (1 - factor) + gray * factor)
          imgData.data[j + 2] = Math.round(imgData.data[j + 2] * (1 - factor) + gray * factor)
        }
        ctx.putImageData(imgData, 0, 0)
        const out = await canvas.convertToBlob({ type: 'image/png' })
        const arr = new Uint8Array(await out.arrayBuffer())
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({ mime: 'image/png', bytes: uint8ToBase64(arr), width: bmp.width, height: bmp.height, size: arr.length, name: `${base}-grayscale.png` })
        bmp.close()
      }
      sendResult(id, results)
      return
    }

    if (operation === 'brightness') {
      const p = payload as { files: ImageBlobPayload[]; opts: { brightness: number; contrast: number; saturation: number } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Adjusting ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const bmp = await createImageBitmap(input)
        const canvas = new OffscreenCanvas(bmp.width, bmp.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height)
        const brightness = p.opts.brightness // -100 to 100
        const contrast = p.opts.contrast // -100 to 100
        const saturation = p.opts.saturation // -100 to 100
        const brightnessF = brightness / 100
        const contrastF = (259 * (contrast + 255)) / (255 * (259 - contrast))
        const satF = 1 + saturation / 100
        for (let j = 0; j < imgData.data.length; j += 4) {
          let r = imgData.data[j] + brightnessF * 255
          let g = imgData.data[j + 1] + brightnessF * 255
          let b = imgData.data[j + 2] + brightnessF * 255
          r = contrastF * (r - 128) + 128
          g = contrastF * (g - 128) + 128
          b = contrastF * (b - 128) + 128
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
          r = gray + satF * (r - gray)
          g = gray + satF * (g - gray)
          b = gray + satF * (b - gray)
          imgData.data[j] = Math.max(0, Math.min(255, Math.round(r)))
          imgData.data[j + 1] = Math.max(0, Math.min(255, Math.round(g)))
          imgData.data[j + 2] = Math.max(0, Math.min(255, Math.round(b)))
        }
        ctx.putImageData(imgData, 0, 0)
        const out = await canvas.convertToBlob({ type: 'image/png' })
        const arr = new Uint8Array(await out.arrayBuffer())
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({ mime: 'image/png', bytes: uint8ToBase64(arr), width: bmp.width, height: bmp.height, size: arr.length, name: `${base}-adjusted.png` })
        bmp.close()
      }
      sendResult(id, results)
      return
    }

    if (operation === 'blur') {
      const p = payload as { files: ImageBlobPayload[]; opts: { radius: number } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Blurring ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const bmp = await createImageBitmap(input)
        const canvas = new OffscreenCanvas(bmp.width, bmp.height)
        const ctx = canvas.getContext('2d')!
        ctx.filter = `blur(${p.opts.radius}px)`
        ctx.drawImage(bmp, 0, 0)
        const out = await canvas.convertToBlob({ type: bmp.width > 0 ? 'image/png' : 'image/png' })
        const arr = new Uint8Array(await out.arrayBuffer())
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({ mime: 'image/png', bytes: uint8ToBase64(arr), width: bmp.width, height: bmp.height, size: arr.length, name: `${base}-blur.png` })
        bmp.close()
      }
      sendResult(id, results)
      return
    }

    if (operation === 'sharpen') {
      const p = payload as { files: ImageBlobPayload[]; opts: { amount: number } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Sharpening ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const bmp = await createImageBitmap(input)
        const canvas = new OffscreenCanvas(bmp.width, bmp.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height)
        const amount = p.opts.amount / 100 // 0 to 2
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
        const w = bmp.width, h = bmp.height
        const src = new Uint8ClampedArray(imgData.data)
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            for (let c = 0; c < 3; c++) {
              let val = 0
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  val += src[((y + ky) * w + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)]
                }
              }
              const idx = (y * w + x) * 4 + c
              imgData.data[idx] = Math.max(0, Math.min(255, Math.round(src[idx] + (val - src[idx]) * amount)))
            }
          }
        }
        ctx.putImageData(imgData, 0, 0)
        const out = await canvas.convertToBlob({ type: 'image/png' })
        const arr = new Uint8Array(await out.arrayBuffer())
        const dot = p.files[i].name.lastIndexOf('.')
        const base = dot === -1 ? p.files[i].name : p.files[i].name.slice(0, dot)
        results.push({ mime: 'image/png', bytes: uint8ToBase64(arr), width: bmp.width, height: bmp.height, size: arr.length, name: `${base}-sharpen.png` })
        bmp.close()
      }
      sendResult(id, results)
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
