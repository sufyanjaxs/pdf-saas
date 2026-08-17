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

type Format = 'image/jpeg' | 'image/webp' | 'image/png'

const FORMATS: { id: Format; name: string }[] = [
  { id: 'image/jpeg', name: 'JPG' },
  { id: 'image/webp', name: 'WEBP' },
  { id: 'image/png', name: 'PNG' },
]

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'

export function ImageCompressorTool() {
  const [files, setFiles] = useState<File[]>([])
  const [format, setFormat] = useState<Format>('image/jpeg')
  const [quality, setQuality] = useState(80)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [summary, setSummary] = useState('')
  const worker = useImageWorker()

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('compress', {
      files: payloads,
      opts: { format, quality: quality / 100 },
    })

    const items: ResultItem[] = res.map((r) => ({
      name: r.name,
      url: resultBlobUrl(r.mime, r.bytes),
      size: r.size,
    }))
    const before = files.reduce((s, f) => s + f.size, 0)
    const after = res.reduce((s, r) => s + r.size, 0)
    const saved = Math.max(0, Math.round((1 - after / before) * 100))
    setSummary(`Saved ${formatBytes(after)} of ${formatBytes(before)} · ${saved}% smaller`)
    setResult(items)
  }, [files, format, quality, worker])

  const reset = useCallback(() => {
    setFiles([])
    setResult(null)
    setSummary('')
  }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => setFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Output format</h3>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                      format === f.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              {format === 'image/png' && (
                <p className="mt-2 text-xs text-slate-400">PNG output ignores the quality slider (lossless).</p>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Quality</h3>
                <span className="text-sm tabular-nums text-slate-500">{quality}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </div>
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              Compress {files.length} image{files.length === 1 ? '' : 's'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Compressing images…'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} summary={summary} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
