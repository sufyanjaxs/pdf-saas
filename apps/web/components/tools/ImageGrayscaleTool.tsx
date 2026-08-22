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
import { Droplets } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

export function ImageGrayscaleTool() {
  const [files, setFiles] = useState<File[]>([])
  const [intensity, setIntensity] = useState(100)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const onFiles = useCallback((f: File[]) => { setFiles(f); setResult(null); releaseResultUrls() }, [])

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null); releaseResultUrls()
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('grayscale', { files: payloads, opts: { intensity } })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}Ã—${r.height}px | ${intensity}% grayscale`,
    }))
    setResult(items)
  }, [files, intensity, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); releaseResultUrls(); setIntensity(100) }, [])

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
            <BlobImg file={files[0]} alt="Preview"
              className="max-h-[50vh] max-w-full rounded bg-white shadow-sm"
              style={{ filter: `grayscale(${intensity}%)`, transition: 'filter 0.2s ease' }} />
          </div>
          <p className="mt-3 text-sm text-slate-500">Preview updates as you adjust</p>
        </div>
      }
      controls={
        <>
          <ControlSection title="Grayscale Intensity">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Amount</label>
              <span className="text-xs font-semibold text-brand-600">{intensity}%</span>
            </div>
            <input type="range" min={0} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full" />
            <div className="mt-1 flex justify-between text-xs text-slate-400"><span>Color</span><span>Grayscale</span></div>
          </ControlSection>
          {worker.error && <ErrorAlert message={worker.error} />}
          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              <Droplets className="mr-1 h-4 w-4" /> Apply Grayscale
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Converting...'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
