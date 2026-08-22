'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { BlobImg } from './BlobImg'
import { Sparkles, Brush, Eraser, Square } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

const PRESETS = [
  { id: 'light', label: 'Light', radius: 2, desc: 'Subtle softening' },
  { id: 'medium', label: 'Medium', radius: 5, desc: 'Standard blur' },
  { id: 'heavy', label: 'Heavy', radius: 10, desc: 'Strong blur' },
  { id: 'custom', label: 'Custom', radius: 0, desc: 'Your choice' },
]

type Mode = 'full' | 'paint'

export function ImageBlurTool() {
  const [files, setFiles] = useState<File[]>([])
  const [presetId, setPreset] = useState('medium')
  const [radius, setRadius] = useState(5)
  const [mode, setMode] = useState<Mode>('full')
  const [brush, setBrush] = useState(30)
  const [erasing, setErasing] = useState(false)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const imgRef = useRef<HTMLImageElement | null>(null)
  const imgUrlRef = useRef<string | null>(null)
  const viewRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement | null>(null)
  const painting = useRef(false)
  const lastPt = useRef<{ x: number; y: number } | null>(null)
  const rafRef = useRef(0)

  const onFiles = useCallback((f: File[]) => { setFiles(f); setResult(null); releaseResultUrls(); setMode('full') }, [])

  const currentPreset = PRESETS.find((p) => p.id === presetId)!
  const effectiveRadius = presetId === 'custom' ? radius : currentPreset.radius

  // ---- image loading (single shared element drives preview + export) ----
  useEffect(() => {
    if (files.length !== 1 || mode !== 'paint') return
    let cancelled = false
    const url = URL.createObjectURL(files[0])
    imgUrlRef.current = url
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      imgRef.current = img
      // size canvases to natural resolution once
      const view = viewRef.current
      const mask = maskRef.current ?? document.createElement('canvas')
      maskRef.current = mask
      for (const cv of [view, mask]) {
        if (!cv) continue
        cv.width = img.naturalWidth
        cv.height = img.naturalHeight
      }
      redraw()
    }
    img.src = url
    return () => {
      cancelled = true
      if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current)
      imgUrlRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, mode])

  /** Composite: original image, then blur only where the mask has paint. */
  const redraw = useCallback(() => {
    const img = imgRef.current
    const view = viewRef.current
    const mask = maskRef.current
    if (!img || !view || !mask) return
    const ctx = view.getContext('2d')
    if (!ctx) return
    const w = img.naturalWidth
    const h = img.naturalHeight

    // blurred copy
    const bl = document.createElement('canvas')
    bl.width = w; bl.height = h
    const bctx = bl.getContext('2d')!
    bctx.filter = `blur(${effectiveRadius}px)`
    bctx.drawImage(img, 0, 0)
    bctx.filter = 'none'
    // keep blur only where painted
    bctx.globalCompositeOperation = 'destination-in'
    bctx.drawImage(mask, 0, 0)

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0)
    ctx.drawImage(bl, 0, 0)
  }, [effectiveRadius])

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; redraw() })
  }, [redraw])

  // live radius changes while painting
  useEffect(() => { if (mode === 'paint') redraw() }, [effectiveRadius, mode, redraw])

  const toCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = e.currentTarget
    const rect = cv.getBoundingClientRect()
    const sx = (cv.width / rect.width) || 1
    const sy = (cv.height / rect.height) || 1
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }, [])

  const strokeTo = useCallback((pt: { x: number; y: number }) => {
    const mask = maskRef.current
    if (!mask) return
    const mctx = mask.getContext('2d')
    if (!mctx) return
    mctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over'
    mctx.strokeStyle = '#ffffff'
    mctx.lineWidth = brush
    mctx.lineCap = 'round'
    mctx.lineJoin = 'round'
    mctx.beginPath()
    const from = lastPt.current ?? pt
    mctx.moveTo(from.x, from.y)
    mctx.lineTo(pt.x, pt.y)
    mctx.stroke()
    lastPt.current = pt
    scheduleRedraw()
  }, [brush, erasing, scheduleRedraw])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    painting.current = true
    lastPt.current = null
    strokeTo(toCanvasPoint(e))
  }, [strokeTo, toCanvasPoint])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current) return
    strokeTo(toCanvasPoint(e))
  }, [strokeTo, toCanvasPoint])
  const onPointerUp = useCallback(() => { painting.current = false; lastPt.current = null }, [])

  const clearMask = useCallback(() => {
    const mask = maskRef.current
    if (!mask) return
    mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height)
    redraw()
  }, [redraw])

  // ---- run paths ----
  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null); releaseResultUrls()
    if (mode === 'paint') {
      const view = viewRef.current
      if (!view) return
      redraw() // ensure final frame
      const blob: Blob = await new Promise((res, rej) =>
        view.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), 'image/png'))
      const base = files[0].name.replace(/\.[^.]+$/, '')
      setResult([{
        name: `${base}-blur-regions.png`,
        url: resultBlobUrl('image/png', new Uint8Array(await blob.arrayBuffer())),
        size: blob.size,
        detail: `Blurred painted regions · ${effectiveRadius}px`,
      }])
      return
    }
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('blur', { files: payloads, opts: { radius: effectiveRadius } })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}×${r.height}px | radius ${effectiveRadius}px`,
    }))
    setResult(items)
  }, [files, effectiveRadius, mode, redraw, worker])

  const reset = useCallback(() => {
    setFiles([]); setResult(null); releaseResultUrls(); setPreset('medium'); setRadius(5); setMode('full')
    maskRef.current = null; imgRef.current = null
  }, [])

  if (files.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  const paintAvailable = files.length === 1

  return (
    <ToolWorkspace
      wide
      preview={
        mode === 'paint' && paintAvailable ? (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <div className="relative overflow-hidden rounded-lg border border-slate-200 shadow-sm">
              <canvas
                ref={viewRef}
                className="block max-h-[55vh] max-w-full touch-none select-none"
                style={{ cursor: 'crosshair' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Paint over what to blur — drag with mouse or finger · {erasing ? 'erasing' : 'brush'} {brush}px
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <div className="overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <BlobImg file={files[0]} alt="Preview"
                className="max-h-[50vh] max-w-full rounded bg-white shadow-sm"
                style={{ filter: `blur(${effectiveRadius}px)`, transition: 'filter 0.2s ease' }} />
            </div>
            <p className="mt-3 text-sm text-slate-500">Preview: {effectiveRadius}px blur radius</p>
          </div>
        )
      }
      controls={
        <>
          <ControlSection title="Mode">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('full')}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${mode === 'full' ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300'}`}>
                <span className={`flex items-center gap-1.5 text-sm font-medium ${mode === 'full' ? 'text-brand-700' : 'text-slate-700'}`}><Square className="h-4 w-4" /> Full image</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">Blur everything</span>
              </button>
              <button type="button" onClick={() => setMode('paint')} disabled={!paintAvailable}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${mode === 'paint' ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300'}`}>
                <span className={`flex items-center gap-1.5 text-sm font-medium ${mode === 'paint' ? 'text-brand-700' : 'text-slate-700'}`}><Brush className="h-4 w-4" /> Paint areas</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">{paintAvailable ? 'You choose where by touch' : 'Single image only'}</span>
              </button>
            </div>
          </ControlSection>

          <ControlSection title="Blur Level">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => { setPreset(p.id); if (p.radius > 0) setRadius(p.radius) }}
                  className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                    presetId === p.id ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300'
                  }`}>
                  <span className={`block text-sm font-medium ${presetId === p.id ? 'text-brand-700' : 'text-slate-700'}`}>{p.label}</span>
                  <span className="block text-[10px] text-slate-400">{p.desc}</span>
                </button>
              ))}
            </div>
            {presetId === 'custom' && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500">Radius (px)</label>
                  <span className="text-xs font-semibold text-brand-600">{radius}px</span>
                </div>
                <input type="range" min={1} max={30} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
              </div>
            )}
          </ControlSection>

          {mode === 'paint' && paintAvailable && (
            <ControlSection title="Brush">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Brush size</label>
                <span className="text-xs font-semibold text-brand-600">{brush}px</span>
              </div>
              <input type="range" min={8} max={90} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-full" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setErasing(false)}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${!erasing ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                  <Brush className="mr-1 inline h-4 w-4" /> Blur brush
                </button>
                <button type="button" onClick={() => setErasing(true)}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${erasing ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                  <Eraser className="mr-1 inline h-4 w-4" /> Eraser
                </button>
              </div>
              <button type="button" onClick={clearMask}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-brand-300">
                Clear selection
              </button>
            </ControlSection>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}
          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0 || (mode === 'paint' && !paintAvailable)} onClick={() => void run()}>
              <Sparkles className="mr-1 h-4 w-4" /> Apply Blur
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Blurring...'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
