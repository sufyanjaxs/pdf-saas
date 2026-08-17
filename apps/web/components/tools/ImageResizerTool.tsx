'use client'

import { useCallback, useState } from 'react'
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

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'

export function ImageResizerTool() {
  const [files, setFiles] = useState<File[]>([])
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [keepRatio, setKeepRatio] = useState(true)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const w = parseInt(width, 10)
  const h = parseInt(height, 10)
  const widthOk = Number.isFinite(w) && w > 0 && w <= 10000
  const heightOk = Number.isFinite(h) && h > 0 && h <= 10000
  const anyDim = (width.trim() !== '' && widthOk) || (height.trim() !== '' && heightOk)

  const run = useCallback(async () => {
    if (files.length === 0 || !anyDim) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('resize', {
      files: payloads,
      opts: {
        width: widthOk ? w : undefined,
        height: keepRatio && widthOk && !heightOk ? undefined : heightOk ? h : undefined,
        fit: keepRatio ? 'contain' : 'stretch',
      },
    })

    const items: ResultItem[] = res.map((r) => ({
      name: r.name,
      url: resultBlobUrl(r.mime, r.bytes),
      size: r.size,
      detail: `${r.width}×${r.height}`,
    }))
    setResult(items)
  }, [files, w, h, widthOk, heightOk, keepRatio, anyDim, worker])

  const reset = useCallback(() => {
    setFiles([])
    setResult(null)
  }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => setFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label htmlFor="rw" className="mb-1 block text-sm font-semibold text-slate-700">Width (px)</label>
              <input
                id="rw"
                type="number"
                min={1}
                max={10000}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="e.g. 1920"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label htmlFor="rh" className="mb-1 block text-sm font-semibold text-slate-700">Height (px)</label>
              <input
                id="rh"
                type="number"
                min={1}
                max={10000}
                value={height}
                disabled={keepRatio && widthOk && height.trim() === ''}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 1080"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} className="text-brand-600" />
              Keep aspect ratio
            </label>
          </div>
          {!anyDim && (
            <p className="text-xs text-slate-400">Enter a width and/or height (1–10000 px).</p>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!anyDim} onClick={() => void run()}>
              Resize {files.length} image{files.length === 1 ? '' : 's'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Resizing images…'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
