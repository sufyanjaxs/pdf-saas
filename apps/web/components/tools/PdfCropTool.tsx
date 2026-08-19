'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { usePdfPages } from '@/hooks/usePdfPages'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'
import { Crop } from 'lucide-react'

interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

const PRESETS: Array<{ label: string; margins: Margins }> = [
  { label: 'Minimal', margins: { top: 2, right: 2, bottom: 2, left: 2 } },
  { label: 'Small', margins: { top: 5, right: 5, bottom: 5, left: 5 } },
  { label: 'Medium', margins: { top: 10, right: 10, bottom: 10, left: 10 } },
  { label: 'Large', margins: { top: 15, right: 15, bottom: 15, left: 15 } },
]

export function PdfCropTool() {
  const [file, setFile] = useState<File | null>(null)
  const [margins, setMargins] = useState<Margins>({ top: 5, right: 5, bottom: 5, left: 5 })
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const { pages, loading, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null)
    await load(f)
  }, [load])

  const setMargin = useCallback((key: keyof Margins, value: number) => {
    setMargins((prev) => ({ ...prev, [key]: Math.max(0, Math.min(49, value)) }))
  }, [])

  // Draw crop preview
  useEffect(() => {
    if (pages.length === 0 || !previewRef.current) return
    const canvas = previewRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const page = pages[0]
    const img = new Image()
    img.onload = () => {
      const maxW = 500
      const scale = Math.min(maxW / img.naturalWidth, 1)
      canvas.width = img.naturalWidth * scale
      canvas.height = img.naturalHeight * scale
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Draw crop margin overlay
      const l = (margins.left / 100) * canvas.width
      const r = (margins.right / 100) * canvas.width
      const t = (margins.top / 100) * canvas.height
      const b = (margins.bottom / 100) * canvas.height

      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      // Top
      ctx.fillRect(0, 0, canvas.width, t)
      // Bottom
      ctx.fillRect(0, canvas.height - b, canvas.width, b)
      // Left
      ctx.fillRect(0, t, l, canvas.height - t - b)
      // Right
      ctx.fillRect(canvas.width - r, t, r, canvas.height - t - b)

      // Draw crop lines
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      // Top
      ctx.beginPath(); ctx.moveTo(l, t); ctx.lineTo(canvas.width - r, t); ctx.stroke()
      // Bottom
      ctx.beginPath(); ctx.moveTo(l, canvas.height - b); ctx.lineTo(canvas.width - r, canvas.height - b); ctx.stroke()
      // Left
      ctx.beginPath(); ctx.moveTo(l, t); ctx.lineTo(l, canvas.height - b); ctx.stroke()
      // Right
      ctx.beginPath(); ctx.moveTo(canvas.width - r, t); ctx.lineTo(canvas.width - r, canvas.height - b); ctx.stroke()
      ctx.setLineDash([])
    }
    img.src = page.dataUrl
  }, [pages, margins])

  const run = useCallback(async () => {
    if (!file) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('crop', { bytes: new Uint8Array(bytes), margins })
    setResult([
      {
        name: defaultOutputName(file.name, 'cropped', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, margins, worker])

  const reset = useCallback(() => {
    setFile(null)
    setMargins({ top: 5, right: 5, bottom: 5, left: 5 })
    setResult(null)
  }, [])

  const fields: Array<{ key: keyof Margins; label: string }> = [
    { key: 'top', label: 'Top %' },
    { key: 'right', label: 'Right %' },
    { key: 'bottom', label: 'Bottom %' },
    { key: 'left', label: 'Left %' },
  ]

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="flex h-full items-center justify-center p-4">
          {loading ? (
            <div className="text-sm text-slate-400">Loading PDF preview...</div>
          ) : pages.length > 0 ? (
            <canvas ref={previewRef} className="max-h-full max-w-full rounded bg-white shadow-lg" />
          ) : (
            <div className="text-center text-sm text-slate-400">Upload a PDF to preview crop</div>
          )}
        </div>
      }
      controls={
        <>
          <FileList files={[file]} onRemove={reset} />

          <ControlSection title="Crop Presets">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setMargins(p.margins)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    JSON.stringify(margins) === JSON.stringify(p.margins) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </ControlSection>

          <ControlSection title="Margins">
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-500">{f.label}</label>
                    <span className="text-xs font-semibold text-brand-600">{margins[f.key]}%</span>
                  </div>
                  <input type="range" min={0} max={49} value={margins[f.key]}
                    onChange={(e) => setMargin(f.key, Number(e.target.value))} className="w-full" />
                </div>
              ))}
            </div>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} onClick={() => void run()}>
              <Crop className="mr-1 h-4 w-4" /> Crop PDF
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Cropping PDF…'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
