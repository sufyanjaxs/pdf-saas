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
import { parseRanges } from '@pdf-saas/pdf-engine'

export function PdfOrganizerTool() {
  const [file, setFile] = useState<File | null>(null)
  const [orderInput, setOrderInput] = useState('')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback(
    (files: File[]) => {
      setFile(files[0])
      setResult(null)
      setOrderInput('')
    },
    [],
  )

  const order = parseRanges(orderInput)

  const run = useCallback(async () => {
    if (!file || order.length === 0) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('reorder', { bytes: new Uint8Array(bytes), order })
    setResult([
      {
        name: defaultOutputName(file.name, 'organized', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
        detail: `${order.length} pages`,
      },
    ])
  }, [file, order, worker])

  const reset = useCallback(() => {
    setFile(null)
    setOrderInput('')
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
            New page order
            <input
              type="text"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              placeholder={`e.g. 3, 1, 4, 2`}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Enter page numbers in the order you want them to appear. Ranges like 2-4 also work.
            </span>
          </label>

          {worker.error && <ErrorAlert message={worker.error} />}

          <Button size="lg" loading={worker.running} disabled={order.length === 0} onClick={() => void run()}>
            Organize Pages
          </Button>
          <ProgressBar value={worker.progress} label={worker.label} />

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
