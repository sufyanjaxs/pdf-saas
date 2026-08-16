'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'

type Position = 'bottom-right' | 'bottom-center' | 'top-right' | 'top-center'

const POSITIONS: Array<{ value: Position; label: string }> = [
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-center', label: 'Top center' },
]

export function PdfPageNumbersTool() {
  const [file, setFile] = useState<File | null>(null)
  const [position, setPosition] = useState<Position>('bottom-right')
  const [format, setFormat] = useState('Page {n} of {total}')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null)
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('page-numbers', {
      bytes: new Uint8Array(bytes),
      position,
      format,
    })
    setResult([
      {
        name: defaultOutputName(file.name, 'numbered', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, position, format, worker])

  const reset = useCallback(() => {
    setFile(null)
    setPosition('bottom-right')
    setFormat('Page {n} of {total}')
    setResult(null)
  }, [])

  return (
    <Card>
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <label className="block text-sm text-slate-700">
            Format (use {'{n}'} for page number and {'{total}'} for page count)
            <input
              type="text"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Position</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPosition(p.value)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    position === p.value
                      ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <Button size="lg" loading={worker.running} onClick={() => void run()}>
            Add Page Numbers
          </Button>
          <ProgressBar value={worker.progress} label={worker.label} />

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
