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

/**
 * Request ids cancelled from the main thread. Batch loops check this between
 * items and bail silently; the main thread settles its own promise on cancel.
 */
const cancelledIds = new Set<string>()

function isCancelled(id: string) {
  return cancelledIds.has(id)
}

function sendProgress(id: string, pct: number, label?: string) {
  if (isCancelled(id)) return
  const msg: WorkerResponse = { id, type: 'progress', data: { pct, label } }
  postMessage(msg)
}

function sendResult(id: string, data: unknown) {
  cancelledIds.delete(id)
  const msg: WorkerResponse = { id, type: 'result', data }
  postMessage(msg)
}

function sendError(id: string, message: string) {
  cancelledIds.delete(id)
  const msg: WorkerResponse = { id, type: 'error', data: message }
  postMessage(msg)
}

function payloadToBlob(p: ImageBlobPayload): Blob {
  return new Blob([base64ToUint8(p.bytes) as unknown as BlobPart], { type: p.mime || 'application/octet-stream' })
}

/** Circle-cropped image with a transparent interior and a colored ring. */
async function circleCropWithRing(input: Blob, borderWidth: number, borderColor: string): Promise<Blob> {
  const bmp = await createImageBitmap(input)
  const size = Math.min(bmp.width, bmp.height)
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - borderWidth, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(bmp, (size - bmp.width) / 2, (size - bmp.height) / 2)
  bmp.close()
  ctx.restore()
  if (borderWidth > 0) {
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - borderWidth / 2, 0, Math.PI * 2)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth
    ctx.stroke()
  }
  return canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Honest local background removal for solid/uniform backgrounds:
 * flood-fills inward from the border, erasing pixels whose color is within
 * `tolerance` of the sampled corner colors. NOT AI matting â€” hair, fur,
 * gradients and busy backgrounds will not be handled well.
 */
async function removeBackground(input: Blob, tolerance: number): Promise<Blob> {
  const bmp = await createImageBitmap(input)
  const w = bmp.width
  const h = bmp.height
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0)
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data
  bmp.close()

  // Reference colors sampled from the four corners.
  const seeds: number[][] = []
  for (const idx of [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4]) {
    seeds.push([d[idx], d[idx + 1], d[idx + 2]])
  }

  const tolSq = tolerance * tolerance
  const matchesBg = (idx4: number): boolean => {
    const r = d[idx4], g = d[idx4 + 1], b = d[idx4 + 2]
    for (let s = 0; s < seeds.length; s++) {
      const dr = r - seeds[s][0]
      const dg = g - seeds[s][1]
      const db = b - seeds[s][2]
      if (dr * dr + dg * dg + db * db <= tolSq) return true
    }
    return false
  }

  // BFS flood fill from matching border pixels.
  const visited = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let qStart = 0
  let qEnd = 0
  const push = (p: number) => {
    if (!visited[p]) {
      visited[p] = 1
      queue[qEnd++] = p
    }
  }
  for (let x = 0; x < w; x++) {
    if (matchesBg(x * 4)) push(x)
    if (matchesBg(((h - 1) * w + x) * 4)) push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    if (matchesBg(y * w * 4)) push(y * w)
    if (matchesBg((y * w + w - 1) * 4)) push(y * w + w - 1)
  }
  while (qStart < qEnd) {
    const p = queue[qStart++]
    const x = p % w
    const y = (p / w) | 0
    if (x > 0 && !visited[p - 1] && matchesBg((p - 1) * 4)) push(p - 1)
    if (x < w - 1 && !visited[p + 1] && matchesBg((p + 1) * 4)) push(p + 1)
    if (y > 0 && !visited[p - w] && matchesBg((p - w) * 4)) push(p - w)
    if (y < h - 1 && !visited[p + w] && matchesBg((p + w) * 4)) push(p + w)
  }

  let erased = 0
  for (let p = 0; p < w * h; p++) {
    if (visited[p]) {
      d[p * 4 + 3] = 0
      erased++
    }
  }
  if (erased > w * h * 0.98) {
    throw new Error('Tolerance too high â€” nearly the whole image matched the background. Lower it and try again.')
  }

  ctx.putImageData(imgData, 0, 0)
  return canvas.convertToBlob({ type: 'image/png' })
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
  if (signal === 'cancel') {
    if (typeof id === 'string') cancelledIds.add(id)
    return
  }

  try {
    if (operation === 'info') {
      const p = payload as AnalyzePayload
      const infos = []
      for (let i = 0; i < p.files.length; i++) {
        if (isCancelled(id)) return
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
        if (isCancelled(id)) return
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
        if (isCancelled(id)) return
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

    if (operation === 'circle-crop' || operation === 'circle') {
      const p = payload as CircleCropPayload
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        if (isCancelled(id)) return
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Processing ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        let out: Blob
        if (p.opts.bgColor) {
          out = await circleCropWithBackground(input, p.opts.bgColor, p.opts.borderWidth ?? 0, p.opts.borderColor ?? '#ffffff')
        } else if ((p.opts.borderWidth ?? 0) > 0) {
          // Transparent center + colored ring (no background fill requested).
          out = await circleCropWithRing(input, p.opts.borderWidth ?? 0, p.opts.borderColor ?? '#ffffff')
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

    if (operation === 'remove-background') {
      const p = payload as { files: ImageBlobPayload[]; opts?: { tolerance?: number } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        if (isCancelled(id)) return
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Removing background ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const out = await removeBackground(input, p.opts?.tolerance ?? 40)
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
          name: `${base}-nobg.png`,
        })
      }
      sendResult(id, results)
      return
    }

    if (operation === 'add-text') {
      const p = payload as {
        files: ImageBlobPayload[]
        opts: { layers: Array<{
          text: string; x: number; y: number; fontSize: number
          fontFamily: string; color: string; bold: boolean; italic: boolean
          shadow: boolean; opacity: number
        }> }
      }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        if (isCancelled(id)) return
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Adding text ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const bmp = await createImageBitmap(input)
        const canvas = new OffscreenCanvas(bmp.width, bmp.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        bmp.close()
        for (const layer of p.opts.layers) {
          ctx.save()
          ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity / 100))
          let font = ''
          if (layer.italic) font += 'italic '
          if (layer.bold) font += 'bold '
          font += `${layer.fontSize}px "${layer.fontFamily}"`
          ctx.font = font
          ctx.fillStyle = layer.color
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          if (layer.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.7)'
            ctx.shadowBlur = 4
            ctx.shadowOffsetX = 2
            ctx.shadowOffsetY = 2
          }
          ctx.fillText(layer.text, layer.x, layer.y)
          ctx.restore()
        }
        // Keep JPEG/WebP inputs in their format (much smaller for photos);
        // everything else becomes PNG.
        const outType = input.type === 'image/jpeg' || input.type === 'image/webp' ? input.type : 'image/png'
        const out = await canvas.convertToBlob({ type: outType, quality: 0.92 })
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
          name: `${base}-text.${ext}`,
        })
      }
      sendResult(id, results)
      return
    }

    if (operation === 'fill-background') {
      const p = payload as { files: ImageBlobPayload[]; opts: { color: string } }
      const results = []
      for (let i = 0; i < p.files.length; i++) {
        if (isCancelled(id)) return
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
        if (isCancelled(id)) return
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
        if (isCancelled(id)) return
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
        if (isCancelled(id)) return
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
        if (isCancelled(id)) return
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
        if (isCancelled(id)) return
        sendProgress(id, ((i + CHUNK) / p.files.length) * 100, `Blurring ${i + 1}/${p.files.length}`)
        const input = payloadToBlob(p.files[i])
        const bmp = await createImageBitmap(input)
        const canvas = new OffscreenCanvas(bmp.width, bmp.height)
        const ctx = canvas.getContext('2d')!
        ctx.filter = `blur(${p.opts.radius}px)`
        ctx.drawImage(bmp, 0, 0)
        const out = await canvas.convertToBlob({ type: 'image/png' })
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
        if (isCancelled(id)) return
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
      if (isCancelled(id)) return
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
