'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { Sun, Contrast, Droplets } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

export function ImageBrightnessTool() {
  const [files, setFiles] = useState<File[]>([])
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const onFiles = useCallback((f: File[]) => { setFiles(f); setResult(null) }, [])

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('brightness', { files: payloads, opts: { brightness, contrast, saturation } })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}×${r.height}px`,
    }))
    setResult(items)
  }, [files, brightness, contrast, saturation, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); setBrightness(0); setContrast(0); setSaturation(0) }, [])

  const filterStr = `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100})`

  if (files.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="flex h-full flex-col items-center justify-center p-4">
          <div className="overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(files[0])} alt="Preview"
              className="max-h-[50vh] max-w-full rounded bg-white shadow-sm"
              style={{ filter: filterStr, transition: 'filter 0.2s ease' }} />
          </div>
          <p className="mt-3 text-sm text-slate-500">Preview updates live</p>
        </div>
      }
      controls={
        <>
          <ControlSection title="Brightness">
            <div className="mb-1 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Sun className="h-3 w-3" /> Level</label>
              <span className="text-xs font-semibold text-brand-600">{brightness > 0 ? '+' : ''}{brightness}</span>
            </div>
            <input type="range" min={-100} max={100} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
          </ControlSection>

          <ControlSection title="Contrast">
            <div className="mb-1 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Contrast className="h-3 w-3" /> Level</label>
              <span className="text-xs font-semibold text-brand-600">{contrast > 0 ? '+' : ''}{contrast}</span>
            </div>
            <input type="range" min={-100} max={100} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full" />
          </ControlSection>

          <ControlSection title="Saturation">
            <div className="mb-1 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Droplets className="h-3 w-3" /> Level</label>
              <span className="text-xs font-semibold text-brand-600">{saturation > 0 ? '+' : ''}{saturation}</span>
            </div>
            <input type="range" min={-100} max={100} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} className="w-full" />
          </ControlSection>

          {(brightness !== 0 || contrast !== 0 || saturation !== 0) && (
            <button type="button" onClick={() => { setBrightness(0); setContrast(0); setSaturation(0) }}
              className="text-sm text-slate-500 hover:text-slate-700">Reset adjustments</button>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}
          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              Apply Adjustments
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Adjusting...'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
