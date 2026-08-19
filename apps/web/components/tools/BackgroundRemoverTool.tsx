'use client'

import { useCallback, useState, useRef } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'
import { Eye, EyeOff } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

export function BackgroundRemoverTool() {
  const [file, setFile] = useState<File | null>(null)
  const [threshold, setThreshold] = useState(30)
  const [edgeProtect, setEdgeProtect] = useState(true)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const abortRef = useRef(false)

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0]); setResult(null); setError(null)
    setOriginalUrl(URL.createObjectURL(files[0]))
  }, [])

  const removeBackground = useCallback(async () => {
    if (!file) return
    setProcessing(true); setProgress(0); setError(null); abortRef.current = false

    try {
      const img = await loadImage(file)
      if (abortRef.current) return
      setProgress(20)
      const canvas = new OffscreenCanvas(img.width, img.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const data = imageData.data
      setProgress(40)
      const bgSamples = sampleCorners(data, img.width, img.height)
      const bgColor = averageColor(bgSamples)
      setProgress(60)
      const mask = floodFillMask(data, img.width, img.height, bgColor, threshold, edgeProtect)
      setProgress(80)
      if (abortRef.current) return
      for (let i = 0; i < data.length; i += 4) { if (!mask[i / 4]) data[i + 3] = 0 }
      ctx.putImageData(imageData, 0, 0)
      const outBlob = await canvas.convertToBlob({ type: 'image/png', quality: 1 })
      setProgress(100)
      const arr = new Uint8Array(await outBlob.arrayBuffer())
      const dot = file.name.lastIndexOf('.')
      const base = dot === -1 ? file.name : file.name.slice(0, dot)
      setResult([{ name: `${base}-no-bg.png`, url: resultBlobUrl('image/png', arr), size: arr.length, detail: `${img.width}x${img.height} | PNG transparent` }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image')
    } finally {
      setProcessing(false); setTimeout(() => setProgress(null), 300)
    }
  }, [file, threshold, edgeProtect])

  const reset = useCallback(() => { setFile(null); setResult(null); setError(null); setOriginalUrl(null) }, [])

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept={ACCEPT} maxSizeMB={50} onFiles={onFiles} hint="Best for images with solid or simple backgrounds" />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Sensitivity</label>
                <span className="text-xs text-slate-400">{threshold}</span>
              </div>
              <input type="range" min={5} max={80} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-brand-600" />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>Less removed</span>
                <span>More removed</span>
              </div>
            </div>
            <label className="flex items-end gap-2 pb-1 text-sm text-slate-700">
              <input type="checkbox" checked={edgeProtect} onChange={(e) => setEdgeProtect(e.target.checked)} className="text-brand-600" />
              Protect edges
            </label>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
            <p className="font-medium mb-1">Works best with solid and simple backgrounds</p>
            <p>For best results, use images where the background is a single color or a simple gradient. Complex backgrounds (trees, buildings, busy patterns) may not be fully removed. All processing happens locally — no data ever leaves your browser.</p>
          </div>

          {result && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Result</h4>
                <button type="button" onClick={() => setShowOriginal(!showOriginal)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50">
                  {showOriginal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showOriginal ? 'Show Result' : 'Show Original'}
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {showOriginal && originalUrl && (
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Original</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={originalUrl} alt="Original" className="max-h-48 rounded-lg border border-slate-200" />
                  </div>
                )}
                {!showOriginal && result.map((item, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs text-slate-400 mb-1">Transparent</p>
                    <div className="rounded-lg border border-slate-200 p-2" style={{ backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)', backgroundSize: '16px 16px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt="No background" className="max-h-48" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <ErrorAlert message={error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={processing} disabled={!file} onClick={() => void removeBackground()}>Remove Background</Button>
            {processing && <Button variant="ghost" onClick={() => { abortRef.current = true }}>Cancel</Button>}
          </div>
          <ProgressBar value={progress} label="Processing..." />
          {processing && <ProcessingOverlay label="Removing background..." progress={progress} onCancel={() => { abortRef.current = true }} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}

function loadImage(file: File): Promise<ImageBitmap> { return createImageBitmap(file) }

function sampleCorners(data: Uint8ClampedArray, w: number, h: number): [number, number, number][] {
  const samples: [number, number, number][] = []
  const radius = Math.min(5, Math.floor(Math.min(w, h) * 0.02))
  for (const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = Math.min(w - 1, Math.max(0, cx + dx))
        const y = Math.min(h - 1, Math.max(0, cy + dy))
        const i = (y * w + x) * 4
        samples.push([data[i], data[i + 1], data[i + 2]])
      }
    }
  }
  return samples
}

function averageColor(samples: [number, number, number][]): [number, number, number] {
  let r = 0, g = 0, b = 0
  for (const [sr, sg, sb] of samples) { r += sr; g += sg; b += sb }
  const n = samples.length
  return [(r / n) | 0, (g / n) | 0, (b / n) | 0]
}

function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function floodFillMask(data: Uint8ClampedArray, w: number, h: number, bgColor: [number, number, number], threshold: number, edgeProtect: boolean): Uint8Array {
  const totalPixels = w * h
  const mask = new Uint8Array(totalPixels)
  const queue: number[] = []
  for (let x = 0; x < w; x++) { checkAndSeed(x, 0); checkAndSeed(x, h - 1) }
  for (let y = 0; y < h; y++) { checkAndSeed(0, y); checkAndSeed(w - 1, y) }

  function checkAndSeed(x: number, y: number) {
    const idx = (y * w + x) * 4
    const dist = colorDist(data[idx], data[idx + 1], data[idx + 2], bgColor[0], bgColor[1], bgColor[2])
    if (dist < threshold * 1.5) { mask[y * w + x] = 1; queue.push(y * w + x) }
  }

  let head = 0
  const expandedThreshold = threshold * 1.3
  while (head < queue.length) {
    const pi = queue[head++]
    const px = pi % w, py = (pi / w) | 0
    mask[pi] = 0
    for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const ni = ny * w + nx
      if (mask[ni] === 1) continue
      const idx = ni * 4
      const dist = colorDist(data[idx], data[idx + 1], data[idx + 2], bgColor[0], bgColor[1], bgColor[2])
      let thresh = expandedThreshold
      if (edgeProtect && isNearEdge(data, w, h, (px + nx) / 2 | 0, (py + ny) / 2 | 0)) thresh *= 0.6
      if (dist < thresh) { mask[ni] = 1; queue.push(ni) }
    }
  }
  return mask
}

function isNearEdge(data: Uint8ClampedArray, w: number, h: number, x: number, y: number): boolean {
  let edgeCount = 0
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx < 1 || nx >= w - 1 || ny < 1 || ny >= h - 1) continue
      const i1 = (ny * w + nx) * 4, i2 = (ny * w + nx + 1) * 4
      if (Math.abs(data[i1] - data[i2]) + Math.abs(data[i1 + 1] - data[i2 + 1]) + Math.abs(data[i1 + 2] - data[i2 + 2]) > 60) edgeCount++
    }
  }
  return edgeCount > 3
}
