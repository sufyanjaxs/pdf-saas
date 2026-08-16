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
import { resultBlobUrl } from '@/lib/client-utils'

const ACCEPT = 'image/jpeg,image/png,image/webp'

export function JpgToPdfTool() {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const move = useCallback((index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }, [])

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const arrays = await Promise.all(files.map((f) => f.arrayBuffer()))
    const res = await worker.run('images-to-pdf', {
      files: arrays.map((b) => new Uint8Array(b)),
      mimes: files.map((f) => f.type),
    })
    const name = `images-${files.length}-pages.pdf`
    setResult([
      {
        name,
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
        detail: `${files.length} image${files.length === 1 ? '' : 's'}`,
      },
    ])
  }, [files, worker])

  const reset = useCallback(() => {
    setFiles([])
    setResult(null)
  }, [])

  return (
    <Card>
      {files.length === 0 ? (
        <FileUploader
          accept={ACCEPT}
          multiple
          maxSizeMB={50}
          minFiles={1}
          hint="Drop JPG, PNG or WEBP images, or browse"
          onFiles={(incoming) => setFiles(incoming)}
        />
      ) : (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                {files.length} image{files.length === 1 ? '' : 's'} — use arrows to set the page order
              </h3>
              <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={reset}>
                Change images
              </button>
            </div>
            <FileList files={files} reorderable onMove={move} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              Create PDF
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
