'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'

const ACCEPT = 'image/jpeg,image/png,image/webp'
type AspectId = 'free' | '1:1' | '4:5' | '16:9'

const ASPECTS: { id: AspectId; label: string; ratio?: number }[] = [
  { id: 'free', label: 'Free' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '16:9', label: '16:9' },
]

interface Sel {
  x: number
  y: number
  w: number
  h: number
}

export function ImageCropperTool() {
  const [file, setFile] = useState<File | null>(null)
  const [aspect, setAspect] = useState<AspectId>('free')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const onFiles = useCallback((files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null)
  }, [])

  const run = useCallback(
    async (crop: { x: number; y: number; width: number; height: number }) => {
      if (!file) return
      setResult(null)
      const payload = await fileToImagePayload(file)
      const [res] = await worker.run('crop', {
        files: [payload],
        opts: crop,
      })
      const dot = file.name.lastIndexOf('.')
      const base = dot === -1 ? file.name : file.name.slice(0, dot)
      setResult([
        {
          name: `${base}-crop.jpg`,
          url: resultBlobUrl(res.mime, res.bytes),
          size: res.size,
          detail: `${res.width}×${res.height}`,
        },
      ])
    },
    [file, worker],
  )

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
  }, [])

  const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio

  return (
    <Card>
      {!file ? (
        <FileUploader accept={ACCEPT} maxSizeMB={50} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Aspect ratio</h3>
            <div className="flex gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAspect(a.id)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    aspect === a.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <CropPreview file={file} aspectRatio={ratio} onCrop={run} disabled={worker.running} />

          {worker.error && <ErrorAlert message={worker.error} />}
          <ProgressBar value={worker.progress} label={worker.label} />
          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Drag-to-select crop preview                                         */
/* ------------------------------------------------------------------ */

function CropPreview({
  file,
  aspectRatio,
  onCrop,
  disabled,
}: {
  file: File
  aspectRatio?: number
  onCrop: (sel: { x: number; y: number; width: number; height: number }) => void
  disabled?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [sel, setSel] = useState<Sel | null>(null)
  const dragging = useRef(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    setSel(null)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const rectOf = () => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return rect ?? { left: 0, top: 0, width: 0, height: 0 }
  }

  const start = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    dragging.current = true
    const rect = rectOf()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setSel({ x, y, w: 0, h: 0 })
  }

  const move = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const rect = rectOf()
    const cx = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const cy = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    setSel((prev) => {
      if (!prev) return prev
      const dx = cx - prev.x
      const dy = cy - prev.y
      const sx = dx < 0 ? -1 : 1
      const sy = dy < 0 ? -1 : 1
      let w = Math.abs(dx)
      let h = Math.abs(dy)
      if (aspectRatio) {
        // lock ratio, keep the drag origin corner fixed
        const side = Math.max(w, h * aspectRatio)
        w = Math.min(side, sx > 0 ? rect.width - prev.x : prev.x)
        h = w / aspectRatio
      }
      return { x: prev.x, y: prev.y, w: sx * w, h: sy * h }
    })
  }

  const end = () => {
    if (!dragging.current) return
    dragging.current = false
    setSel((prev) => {
      if (!prev || Math.abs(prev.w) < 10 || Math.abs(prev.h) < 10) return null
      return { x: Math.min(prev.x, prev.x + prev.w), y: Math.min(prev.y, prev.y + prev.h), w: Math.abs(prev.w), h: Math.abs(prev.h) }
    })
  }

  const scale = () => {
    if (natural.w === 0) return { sx: 1, sy: 1 }
    const rect = rectOf()
    return { sx: natural.w / (rect.width || 1), sy: natural.h / (rect.height || 1) }
  }

  const crop = () => {
    const s = sel
    if (!s) return
    const { sx, sy } = scale()
    onCrop({
      x: Math.round(s.x * sx),
      y: Math.round(s.y * sy),
      width: Math.round(s.w * sx),
      height: Math.round(s.h * sy),
    })
  }

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative mx-auto inline-block cursor-crosshair overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
        style={{ maxWidth: '100%' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt="Image to crop"
            className="max-h-[480px] w-auto select-none"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget
              setNatural({ w: el.naturalWidth, h: el.naturalHeight })
            }}
          />
        )}
        {sel && sel.w !== 0 && sel.h !== 0 && (
          <div
            className="pointer-events-none absolute border-2 border-brand-500 bg-brand-500/20"
            style={{
              left: Math.min(sel.x, sel.x + sel.w),
              top: Math.min(sel.y, sel.y + sel.h),
              width: Math.abs(sel.w),
              height: Math.abs(sel.h),
            }}
          >
            <span className="absolute -bottom-6 left-0 whitespace-nowrap text-xs font-medium text-slate-700">
              {Math.round(Math.abs(sel.w) * scale().sx)}×{Math.round(Math.abs(sel.h) * scale().sy)} px
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={crop} disabled={!sel || disabled} loading={disabled}>
          Crop
        </Button>
        {sel && (
          <Button variant="ghost" size="sm" onClick={() => setSel(null)}>
            Clear selection
          </Button>
        )}
      </div>
      {!sel && (
        <p className="mt-3 text-xs text-slate-400">
          Drag on the image to select the area to keep. Original: {natural.w}×{natural.h} px · {formatBytes(file.size)}
        </p>
      )}
    </div>
  )
}
