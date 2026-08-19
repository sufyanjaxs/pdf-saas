'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'

const ACCEPT = 'image/jpeg,image/png,image/webp'

type AspectId = 'free' | '1:1' | '4:5' | '16:9' | '3:2' | '9:16' | '2:3' | 'custom'
type InputMode = 'visual' | 'dimensions' | 'crop-sides'

interface AspectDef { id: AspectId; label: string; ratio?: number }
interface Sel { x: number; y: number; w: number; h: number }

const ASPECTS: AspectDef[] = [
  { id: 'free', label: 'Free' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
  { id: 'custom', label: 'Custom' },
]

export function ImageCropperTool() {
  const [file, setFile] = useState<File | null>(null)
  const [aspect, setAspect] = useState<AspectId>('free')
  const [customRatioW, setCustomRatioW] = useState('')
  const [customRatioH, setCustomRatioH] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('visual')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const onFiles = useCallback((files: File[]) => { setFile(files[0]); setResult(null) }, [])

  const run = useCallback(async (crop: { x: number; y: number; width: number; height: number }) => {
    if (!file) return
    setResult(null)
    const payload = await fileToImagePayload(file)
    const [res] = await worker.run('crop', { files: [payload], opts: crop })
    const dot = file.name.lastIndexOf('.')
    const base = dot === -1 ? file.name : file.name.slice(0, dot)
    setResult([{ name: `${base}-crop.jpg`, url: resultBlobUrl(res.mime, res.bytes), size: res.size, detail: `${res.width}x${res.height}` }])
  }, [file, worker])

  const reset = useCallback(() => { setFile(null); setResult(null) }, [])

  const currentAspect = ASPECTS.find((a) => a.id === aspect)
  let ratio = currentAspect?.ratio
  if (aspect === 'custom') {
    const w = parseFloat(customRatioW), h = parseFloat(customRatioH)
    if (w > 0 && h > 0) ratio = w / h
  }

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept={ACCEPT} maxSizeMB={50} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Aspect ratio</h3>
            <div className="flex flex-wrap gap-2">
              {ASPECTS.map((a) => (
                <button key={a.id} type="button" onClick={() => setAspect(a.id)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    aspect === a.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}>{a.label}</button>
              ))}
            </div>
            {aspect === 'custom' && (
              <div className="mt-3 flex items-center gap-2">
                <input type="number" min={1} max={100} value={customRatioW} onChange={(e) => setCustomRatioW(e.target.value)} placeholder="W" className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
                <span className="text-slate-400">:</span>
                <input type="number" min={1} max={100} value={customRatioH} onChange={(e) => setCustomRatioH(e.target.value)} placeholder="H" className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {(['visual', 'dimensions', 'crop-sides'] as InputMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setInputMode(m)}
                className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                  inputMode === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                }`}>
                {m === 'visual' ? 'Drag to Crop' : m === 'dimensions' ? 'Exact Dims' : 'Crop from Sides'}
              </button>
            ))}
          </div>

          <CropPreview file={file} aspectRatio={ratio} inputMode={inputMode} onCrop={run} disabled={worker.running} />

          {worker.error && <ErrorAlert message={worker.error} />}
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Cropping...'} progress={worker.progress} onCancel={worker.cancel} />}
          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}

function CropPreview({
  file, aspectRatio, inputMode, onCrop, disabled,
}: {
  file: File; aspectRatio?: number; inputMode: InputMode; onCrop: (s: { x: number; y: number; width: number; height: number }) => void; disabled?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [sel, setSel] = useState<Sel | null>(null)
  const dragging = useRef(false)
  const dragMode = useRef<'create' | 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'lm' | 'rm'>('create')
  const startPos = useRef({ x: 0, y: 0, origSel: null as Sel | null })
  const [posX, setPosX] = useState('')
  const [posY, setPosY] = useState('')
  const [sizeW, setSizeW] = useState('')
  const [sizeH, setSizeH] = useState('')
  const [trimTop, setTrimTop] = useState('')
  const [trimBottom, setTrimBottom] = useState('')
  const [trimLeft, setTrimLeft] = useState('')
  const [trimRight, setTrimRight] = useState('')

  useEffect(() => { const url = URL.createObjectURL(file); setSrc(url); setSel(null); return () => URL.revokeObjectURL(url) }, [file])

  const rectOf = () => { const r = wrapRef.current?.getBoundingClientRect(); return r ?? { left: 0, top: 0, width: 0, height: 0 } }
  const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v))

  const scale = () => {
    if (natural.w === 0) return { sx: 1, sy: 1 }
    const r = rectOf()
    return { sx: natural.w / (r.width || 1), sy: natural.h / (r.height || 1) }
  }

  const applyAspect = (s: Sel, rectW: number, rectH: number) => {
    if (!aspectRatio) return s
    let { x, y, w, h } = s
    if (dragMode.current === 'create' || dragMode.current === 'tm' || dragMode.current === 'bm') {
      h = w / aspectRatio
    } else {
      w = h * aspectRatio
    }
    if (x + w > rectW) { w = rectW - x; h = w / aspectRatio }
    if (y + h > rectH) { h = rectH - y; w = h * aspectRatio }
    if (x < 0) { w += x; x = 0; h = w / aspectRatio }
    if (y < 0) { h += y; y = 0; w = h * aspectRatio }
    return { x, y, w, h }
  }

  const startDrag = (e: React.PointerEvent, mode: typeof dragMode.current) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
    dragMode.current = mode
    const r = rectOf()
    const x = e.clientX - r.left, y = e.clientY - r.top
    startPos.current = { x, y, origSel: sel ? { ...sel } : null }

    if (mode === 'create') {
      setSel({ x, y, w: 0, h: 0 })
    }
  }

  const onMove = (e: React.PointerEvent) => {
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
        let h = Math.abs(cy - startPos.current.y)
        const x = Math.min(cx, startPos.current.x)
        const y = Math.min(cy, startPos.current.y)
        return applyAspect({ x, y, w: Math.max(2, w), h: Math.max(2, h) }, r.width, r.height)
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
        nh = Math.max(20, dm === 'bm' || dm === 'rm' ? cy - os.y : nh)
        if (dm !== 'rm') nh = aspectRatio ? nw / aspectRatio : Math.max(20, cy - os.y)
        if (dm !== 'bm') nw = aspectRatio ? nh * aspectRatio : Math.max(20, cx - os.x)
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
  }

  const endDrag = () => { dragging.current = false }

  const doCrop = () => {
    if (!sel) return
    const { sx, sy } = scale()
    onCrop({ x: Math.round(sel.x * sx), y: Math.round(sel.y * sy), width: Math.round(sel.w * sx), height: Math.round(sel.h * sy) })
  }

  useEffect(() => {
    if (sel) {
      const { sx, sy } = scale()
      setPosX(String(Math.round(sel.x * sx)))
      setPosY(String(Math.round(sel.y * sy)))
      setSizeW(String(Math.round(sel.w * sx)))
      setSizeH(String(Math.round(sel.h * sy)))
      const iw = natural.w, ih = natural.h
      setTrimTop(String(Math.round(sel.y * sy)))
      setTrimBottom(String(Math.round(ih - (sel.y + sel.h) * sy)))
      setTrimLeft(String(Math.round(sel.x * sx)))
      setTrimRight(String(Math.round(iw - (sel.x + sel.w) * sx)))
    }
  }, [sel, natural])

  const syncFromDimInputs = () => {
    if (!sel) return
    const x = parseInt(posX, 10), y = parseInt(posY, 10), w = parseInt(sizeW, 10), h = parseInt(sizeH, 10)
    if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) {
      const { sx, sy } = scale()
      const r = rectOf()
      setSel(applyAspect({ x: x / sx, y: y / sy, w: w / sx, h: h / sy }, r.width, r.height))
    }
  }

  const syncFromSideInputs = () => {
    const t = parseInt(trimTop, 10) || 0, b = parseInt(trimBottom, 10) || 0
    const l = parseInt(trimLeft, 10) || 0, ri = parseInt(trimRight, 10) || 0
    const { sx, sy } = scale()
    const r = rectOf()
    const w = (natural.w - l - ri) / sx
    const h = (natural.h - t - b) / sy
    if (w > 0 && h > 0) {
      setSel(applyAspect({ x: l / sx, y: t / sy, w, h }, r.width, r.height))
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    const r = rectOf()
    const x = e.clientX - r.left, y = e.clientY - r.top

    if (sel && x >= sel.x && x <= sel.x + sel.w && y >= sel.y && y <= sel.y + sel.h) {
      startDrag(e, 'move')
      return
    }
    startDrag(e, 'create')
  }

  const CursorForHandle = (hx: number, hy: number) => {
    if (!sel) return 'crosshair'
    const cx = sel.x + sel.w / 2, cy = sel.y + sel.h / 2
    const dx = hx - cx, dy = hy - cy
    if (Math.abs(dx) > Math.abs(dy) * 2) return 'ew-resize'
    if (Math.abs(dy) > Math.abs(dx) * 2) return 'ns-resize'
    return (dx > 0 === dy > 0) ? 'nwse-resize' : 'nesw-resize'
  }

  return (
    <div>
      <div ref={wrapRef}
        className="relative mx-auto inline-block overflow-hidden rounded-xl border border-slate-200 bg-slate-100 touch-none"
        style={{ maxWidth: '100%' }} onPointerDown={handlePointerDown} onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Image to crop" className="max-h-[480px] w-auto select-none" draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        )}
        {sel && sel.w > 0 && sel.h > 0 && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-black/40" />
            <div className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
              style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}>
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 h-px w-full bg-white/30" />
              <div className="absolute top-2/3 left-0 h-px w-full bg-white/30" />
            </div>
            {(['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'lm', 'rm'] as const).map((h) => {
              const isCorner = h.length === 2
              const hx = h.includes('l') ? sel.x : h.includes('r') ? sel.x + sel.w : sel.x + sel.w / 2
              const hy = h.includes('t') ? sel.y : h.includes('b') ? sel.y + sel.h : sel.y + sel.h / 2
              return (
                <div key={h} className={`absolute z-10 ${isCorner ? 'h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500' : (h === 'tm' || h === 'bm') ? 'h-2 w-8 -translate-x-1/2 rounded-full border border-white bg-brand-500' : 'h-8 w-2 -translate-y-1/2 rounded-full border border-white bg-brand-500'}`}
                  style={{ left: hx, top: hy, cursor: CursorForHandle(hx, hy), transform: `translate(-50%, -50%)` }}
                  onPointerDown={(e) => startDrag(e, h)} />
              )
            })}
          </>
        )}
      </div>

      {sel && sel.w > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button size="lg" onClick={doCrop} disabled={disabled} loading={disabled}>Crop</Button>
            <Button variant="ghost" size="sm" onClick={() => setSel(null)}>Clear</Button>
          </div>

          {inputMode === 'dimensions' && sel.w > 0 && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
              {[
                { label: 'X', val: posX, set: setPosX },
                { label: 'Y', val: posY, set: setPosY },
                { label: 'W', val: sizeW, set: setSizeW },
                { label: 'H', val: sizeH, set: setSizeH },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-xs font-medium text-slate-500">{f.label} (px)</label>
                  <input type="number" value={f.val} onChange={(e) => f.set(e.target.value)} onBlur={syncFromDimInputs}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
                </div>
              ))}
            </div>
          )}

          {inputMode === 'crop-sides' && sel.w > 0 && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
              {[
                { label: 'Top', val: trimTop, set: setTrimTop },
                { label: 'Bottom', val: trimBottom, set: setTrimBottom },
                { label: 'Left', val: trimLeft, set: setTrimLeft },
                { label: 'Right', val: trimRight, set: setTrimRight },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-xs font-medium text-slate-500">{f.label} (px)</label>
                  <input type="number" min={0} value={f.val} onChange={(e) => f.set(e.target.value)} onBlur={syncFromSideInputs}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
                </div>
              ))}
              <p className="w-full text-xs text-slate-400">Output: {Math.max(0, natural.w - (parseInt(trimLeft) || 0) - (parseInt(trimRight) || 0))}x{Math.max(0, natural.h - (parseInt(trimTop) || 0) - (parseInt(trimBottom) || 0))} px</p>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Selection: {Math.round(sel.w * scale().sx)}x{Math.round(sel.h * scale().sy)} px &middot; Original: {natural.w}x{natural.h} px &middot; {formatBytes(file.size)}
          </p>
        </div>
      )}

      {!sel && (
        <p className="mt-3 text-xs text-slate-400">
          Drag on the image to select the area to keep. Original: {natural.w}x{natural.h} px &middot; {formatBytes(file.size)}
        </p>
      )}
    </div>
  )
}
