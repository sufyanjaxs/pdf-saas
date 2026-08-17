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
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'

type Level = 'balanced' | 'strong' | 'maximum'

const LEVELS: { id: Level; name: string; description: string }[] = [
  { id: 'balanced', name: 'Balanced', description: 'Lossless cleanup — great for most PDFs' },
  { id: 'strong', name: 'Strong', description: 'Recompresses images for smaller files' },
  { id: 'maximum', name: 'Maximum', description: 'Smallest size, some image quality loss' },
]

export function PdfCompressorTool() {
  const [file, setFile] = useState<File | null>(null)
  const [level, setLevel] = useState<Level>('balanced')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null)
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    setResult(null)
    const bytes = await file.arrayBuffer()
    const res = await worker.run('compress', {
      bytes: new Uint8Array(bytes),
      level,
    })
    if (res.kind !== 'compress') return
    const saved = Math.max(0, Math.round((1 - res.compressedSize / res.originalSize) * 100))
    const name = defaultOutputName(file.name, `compressed-${level}`, 'application/pdf')
    setResult([
      {
        name,
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.compressedSize,
        detail: `${formatBytes(res.originalSize)} → ${formatBytes(res.compressedSize)} · saved ${saved}%`,
      },
    ])
  }, [file, level, worker])

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
  }, [])

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Compression level</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    level === l.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">{l.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{l.description}</p>
                </button>
              ))}
            </div>
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} onClick={() => void run()}>
              Compress PDF
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Compressing PDF…'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
