'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'
import { RotateCcw } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

interface CropPreset {
  id: string
  label: string
  sublabel: string
  ratio?: number
}

const PRESETS: CropPreset[] = [
  { id: 'free', label: 'Free', sublabel: 'Any size' },
  { id: 'square', label: 'Square', sublabel: '1:1', ratio: 1 },
  { id: 'portrait', label: 'Portrait', sublabel: '4:5', ratio: 4 / 5 },
  { id: 'landscape', label: 'Landscape', sublabel: '3:2', ratio: 3 / 2 },
  { id: 'ig-post', label: 'Instagram', sublabel: '4:5', ratio: 4 / 5 },
  { id: 'ig-story', label: 'Story', sublabel: '9:16', ratio: 9 / 16 },
  { id: 'yt-thumb', label: 'YouTube', sublabel: '16:9', ratio: 16 / 9 },
  { id: 'passport', label: 'Passport', sublabel: '1:1', ratio: 1 },
  { id: 'custom', label: 'Custom', sublabel: 'W:H' },
]

type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'lm' | 'rm'
interface Sel { x: number; y: number; w: number; h: number }

export function ImageCropperTool() {
  const [file, setFile] = useState<File | null>(null)
  const [preset, setPreset] = useState('free')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [lockRatio, setLockRatio] = useState(false)
  const [dimW, setDimW] = useState('')
  const [dimH, setDimH] = useState('')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null)
    setPreset('free')
    setDimW('')
    setDimH('')
  }, [])

  const currentPreset = PRESETS.find((p) => p.id === preset)
  let aspectRatio: number | undefined
  if (preset === 'custom') {
    const cw = parseFloat(customW), ch = parseFloat(customH)
    if (cw > 0 && ch > 0) aspectRatio = cw / ch
  } else {
    aspectRatio = currentPreset?.ratio
  }

  const run = useCallback(async (crop: { x: number; y: number; width: number; height: number }) => {
    if (!file) return
    setResult(null)
    const payload = await fileToImagePayload(file)
    const [res] = await worker.run('crop', { files: [payload], opts: crop })
    const dot = file.name.lastIndexOf('.')
    const base = dot === -1 ? file.name : file.name.slice(0, dot)
    setResult([{ name: `${base}-crop.jpg`, url: resultBlobUrl(res.mime, res.bytes), size: res.size, detail: `${res.width}×${res.height}` }])
  }, [file, worker])

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
    setPreset('free')
    setDimW('')
    setDimH('')
  }, [])

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept={ACCEPT} maxSizeMB={50} multiple={false} onFiles={onFiles} />
      ) : (
        <div className="space-y-5">
          <FileList files={[file]} onRemove={reset} />

          {/* Presets */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Crop Shape</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-center transition-all ${
                    preset === p.id
                      ? 'border-brand-600 bg-brand-50 shadow-sm'
                      : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`block text-sm font-medium ${preset === p.id ? 'text-brand-700' : 'text-slate-700'}`}>
                    {p.label}
                  </span>
                  <span className="block text-[11px] text-slate-400">{p.sublabel}</span>
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number" min={1} max={100} value={customW} onChange={(e) => setCustomW(e.target.value)}
                  placeholder="W" className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                />
                <span className="text-slate-400">:</span>
                <input
                  type="number" min={1} max={100} value={customH} onChange={(e) => setCustomH(e.target.value)}
                  placeholder="H" className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
            )}
          </div>

          {/* Interactive crop area */}
          <CropCanvas file={file} aspectRatio={aspectRatio} onCrop={run} onDimChange={(w, h) => { setDimW(String(w)); setDimH(String(h)) }} disabled={worker.running} />

          {/* Dimension inputs */}
          {dimW && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Width (px)</label>
                <input type="text" readOnly value={dimW} className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Height (px)</label>
                <input type="text" readOnly value={dimH} className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600" />
              </div>
            </div>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}
          {worker.running && <ProcessingOverlay label={worker.label || 'Cropping...'} progress={worker.progress} onCancel={worker.cancel} />}
          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}

function CropCanvas({
  file, aspectRatio, onCrop, onDimChange, disabled,
}: {
  file: File; aspectRatio?: number; onCrop: (s: { x: number; y: number; width: number; height: number }) => void; onDimChange: (w: number, h: number) => void; disabled?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [sel, setSel] = useState<Sel | null>(null)
  const dragging = useRef(false)
  const dragMode = useRef<'create' | 'move' | Handle>('create')
  const startPos = useRef({ x: 0, y: 0, origSel: null as Sel | null })

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    setSel(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const rectOf = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect()
    return r ?? { left: 0, top: 0, width: 0, height: 0 }
  }, [])

  const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v))

  const scale = useCallback(() => {
    if (natural.w === 0) return { sx: 1, sy: 1 }
    const img = wrapRef.current?.querySelector('img')
    if (!img) return { sx: 1, sy: 1 }
    const r = img.getBoundingClientRect()
    return { sx: natural.w / (r.width || 1), sy: natural.h / (r.height || 1) }
  }, [natural])

  const applyAspect = useCallback((s: Sel, rectW: number, rectH: number): Sel => {
    if (!aspectRatio) return s
    let { x, y, w, h } = s
    const dm = dragMode.current
    if (dm === 'create' || dm === 'tm' || dm === 'bm') {
      h = w / aspectRatio
    } else {
      w = h * aspectRatio
    }
    if (x + w > rectW) { w = rectW - x; h = w / aspectRatio }
    if (y + h > rectH) { h = rectH - y; w = h * aspectRatio }
    if (x < 0) { w += x; x = 0; h = w / aspectRatio }
    if (y < 0) { h += y; y = 0; w = h * aspectRatio }
    return { x, y, w: Math.max(10, w), h: Math.max(10, h) }
  }, [aspectRatio])

  const startDrag = useCallback((e: React.PointerEvent, mode: typeof dragMode.current) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
    dragMode.current = mode
    const r = rectOf()
    const x = e.clientX - r.left, y = e.clientY - r.top
    startPos.current = { x, y, origSel: sel ? { ...sel } : null }
    if (mode === 'create') setSel({ x, y, w: 0, h: 0 })
  }, [disabled, rectOf, sel])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const r = rectOf()
    const cx = clamp(e.clientX - r.left, 0, r.width)
    const cy = clamp(e.clientY - r.top, 0, r.height)
    const dx = cx - startPos.current.x
    const dy = cy - startPos.current.y
    const os = startPos.current.origSel

    setSel((prev) => {
      if (!prev) return prev
      if (dragMode.current === 'create') {
        let w = Math.abs(cx - startPos.current.x)
        let h = aspectRatio ? w / aspectRatio : Math.abs(cy - startPos.current.y)
        if (!aspectRatio) h = Math.abs(cy - startPos.current.y)
        const x = Math.min(cx, startPos.current.x)
        const y = Math.min(cy, startPos.current.y)
        return applyAspect({ x, y: aspectRatio ? Math.min(startPos.current.y, startPos.current.y + (cy > startPos.current.y ? h : -h)) : y, w: Math.max(2, w), h: Math.max(2, h) }, r.width, r.height)
      }
      if (!os) return prev
      if (dragMode.current === 'move') {
        const nx = clamp(os.x + dx, 0, r.width - os.w)
        const ny = clamp(os.y + dy, 0, r.height - os.h)
        return { ...prev, x: nx, y: ny }
      }
      let { x: nx, y: ny, w: nw, h: nh } = os
      const dm = dragMode.current
      if (dm === 'br' || dm === 'rm' || dm === 'bm') {
        nw = Math.max(20, dm === 'bm' || dm === 'rm' ? nw : cx - os.x)
        nh = Math.max(20, dm === 'bm' || dm === 'rm' ? nh : cy - os.y)
        if (dm !== 'rm' && aspectRatio) nh = nw / aspectRatio
        if (dm !== 'bm' && aspectRatio) nw = nh * aspectRatio
      }
      if (dm === 'tl') {
        nw = Math.max(20, os.x + os.w - cx)
        nh = aspectRatio ? nw / aspectRatio : Math.max(20, os.y + os.h - cy)
        nx = os.x + os.w - nw
        ny = aspectRatio ? os.y + os.h - nh : os.y + os.h - nh
      }
      if (dm === 'tr') {
        nw = Math.max(20, cx - os.x)
        nh = aspectRatio ? nw / aspectRatio : Math.max(20, os.y + os.h - cy)
        ny = os.y + os.h - nh
      }
      if (dm === 'bl') {
        nw = Math.max(20, os.x + os.w - cx)
        nh = aspectRatio ? nw / aspectRatio : Math.max(20, cy - os.y)
        nx = os.x + os.w - nw
      }
      if (dm === 'tm') { nh = Math.max(20, os.y + os.h - cy); nw = aspectRatio ? nh * aspectRatio : os.w; ny = os.y + os.h - nh }
      if (dm === 'bm') { nh = Math.max(20, cy - os.y); nw = aspectRatio ? nh * aspectRatio : os.w }
      nx = clamp(nx, 0, r.width - nw)
      ny = clamp(ny, 0, r.height - nh)
      return { x: nx, y: ny, w: nw, h: nh }
    })
  }, [rectOf, aspectRatio, applyAspect])

  const endDrag = useCallback(() => {
    if (dragging.current) dragging.current = false
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    const r = rectOf()
    const x = e.clientX - r.left, y = e.clientY - r.top
    if (sel && x >= sel.x && x <= sel.x + sel.w && y >= sel.y && y <= sel.y + sel.h) {
      startDrag(e, 'move')
      return
    }
    startDrag(e, 'create')
  }, [disabled, rectOf, sel, startDrag])

  useEffect(() => {
    if (sel && sel.w > 0 && sel.h > 0) {
      const { sx, sy } = scale()
      onDimChange(Math.round(sel.w * sx), Math.round(sel.h * sy))
    }
  }, [sel, scale, onDimChange])

  const doCrop = useCallback(() => {
    if (!sel || sel.w < 5) return
    const { sx, sy } = scale()
    onCrop({ x: Math.round(sel.x * sx), y: Math.round(sel.y * sy), width: Math.round(sel.w * sx), height: Math.round(sel.h * sy) })
  }, [sel, scale, onCrop])

  const handleCursor = useCallback((hx: number, hy: number) => {
    if (!sel) return 'crosshair'
    const cx = sel.x + sel.w / 2, cy = sel.y + sel.h / 2
    const dx = hx - cx, dy = hy - cy
    if (Math.abs(dx) > Math.abs(dy) * 2) return 'ew-resize'
    if (Math.abs(dy) > Math.abs(dx) * 2) return 'ns-resize'
    return dx > 0 === dy > 0 ? 'nwse-resize' : 'nesw-resize'
  }, [sel])

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative mx-auto inline-block overflow-hidden rounded-xl border border-slate-200 bg-slate-100 touch-none"
        style={{ maxWidth: '100%' }}
        onPointerDown={handlePointerDown}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Image to crop"
            className="max-h-[480px] w-auto select-none"
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
        )}
        {sel && sel.w > 0 && sel.h > 0 && (
          <>
            {/* Dark overlay outside crop */}
            <div className="pointer-events-none absolute inset-0 bg-black/40" />

            {/* Crop area (clear) */}
            <div
              className="pointer-events-none absolute border-2 border-white"
              style={{
                left: sel.x, top: sel.y, width: sel.w, height: sel.h,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
              }}
            >
              {/* Rule of thirds grid */}
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 h-px w-full bg-white/30" />
              <div className="absolute top-2/3 left-0 h-px w-full bg-white/30" />
            </div>

            {/* Handles */}
            {(['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'lm', 'rm'] as const).map((h) => {
              const isCorner = h.length === 2
              const hx = h.includes('l') ? sel.x : h.includes('r') ? sel.x + sel.w : sel.x + sel.w / 2
              const hy = h.includes('t') ? sel.y : h.includes('b') ? sel.y + sel.h : sel.y + sel.h / 2
              return (
                <div
                  key={h}
                  className={`absolute z-10 ${isCorner
                    ? 'h-4 w-4 rounded-full border-2 border-white bg-brand-500 shadow-md'
                    : (h === 'tm' || h === 'bm')
                      ? 'h-2.5 w-10 -translate-x-1/2 rounded-full border border-white bg-brand-500'
                      : 'h-10 w-2.5 -translate-y-1/2 rounded-full border border-white bg-brand-500'
                  }`}
                  style={{
                    left: hx, top: hy,
                    cursor: handleCursor(hx, hy),
                    transform: 'translate(-50%, -50%)',
                  }}
                  onPointerDown={(e) => startDrag(e, h)}
                />
              )
            })}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex items-center gap-3">
        <Button size="lg" onClick={doCrop} disabled={disabled || !sel || sel.w < 5} loading={disabled}>
          Crop Image
        </Button>
        {sel && (
          <Button variant="ghost" size="sm" onClick={() => setSel(null)}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      {!sel && (
        <p className="mt-3 text-center text-sm text-slate-400">
          Drag on the image to select the area to keep
        </p>
      )}
    </div>
  )
}
