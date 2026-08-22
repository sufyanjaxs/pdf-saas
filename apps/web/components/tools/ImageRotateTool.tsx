'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileUploader } from './FileUploader'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { BlobImg } from './BlobImg'
import { RotateCcw, RotateCw } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

export function ImageRotateTool() {
  const [files, setFiles] = useState<File[]>([])
  const [degrees, setDegrees] = useState(90)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [previewRotation, setPreviewRotation] = useState(0)
  const worker = useImageWorker()

  const onFiles = useCallback((f: File[]) => { setFiles(f); setResult(null); releaseResultUrls(); setPreviewRotation(0) }, [])

  // Live preview rotation
  useEffect(() => {
    if (files.length === 0) return
    setPreviewRotation(degrees)
  }, [degrees, files])

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null); releaseResultUrls()
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('rotate', { files: payloads, opts: { degrees } })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}Ã—${r.height}px | ${degrees}Â°`,
    }))
    setResult(items)
  }, [files, degrees, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); releaseResultUrls(); setDegrees(90); setPreviewRotation(0) }, [])

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
          <div className="overflow-hidden rounded-lg" style={{ transition: 'transform 0.3s ease', transform: `rotate(${previewRotation}deg)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <BlobImg file={files[0]} alt="Preview"
              className="max-h-[50vh] max-w-full rounded bg-white shadow-sm"
            />
          </div>
          <p className="mt-3 text-sm text-slate-500">Preview rotates as you adjust</p>
        </div>
      }
      controls={
        <>
          <ControlSection title="Rotation">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDegrees((d) => (d - 90) % 360)} className="flex-1">
                <RotateCcw className="mr-1 h-4 w-4" /> Left 90Â°
              </Button>
              <Button variant="outline" onClick={() => setDegrees((d) => (d + 90) % 360)} className="flex-1">
                <RotateCw className="mr-1 h-4 w-4" /> Right 90Â°
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => setDegrees(180)} className="flex-1">180Â°</Button>
              <Button variant="outline" onClick={() => setDegrees(0)} className="flex-1">Reset</Button>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Custom angle</label>
                <span className="text-xs font-semibold text-brand-600">{degrees}Â°</span>
              </div>
              <input
                type="range" min={-180} max={180} value={degrees}
                onChange={(e) => setDegrees(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0 || degrees === 0} onClick={() => void run()}>
              Rotate Image
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Rotating...'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
