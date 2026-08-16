'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePdfPages } from '@/hooks/usePdfPages'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'
import { parsePageRanges } from '@pdf-saas/file-utils'

export function PdfExtractorTool() {
  const [file, setFile] = useState<File | null>(null)
  const [rangeInput, setRangeInput] = useState('')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const { pageCount, error: pageError, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback(
    (files: File[]) => {
      const f = files[0]
      setFile(f)
      setResult(null)
      setRangeInput('')
      void load(f)
    },
    [load],
  )

  const parsed = file ? parsePageRanges(rangeInput, pageCount) : []
  const validRange = parsed.length > 0 && parsed.length <= pageCount

  const run = useCallback(async () => {
    if (!file || !validRange) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('extract', {
      bytes: new Uint8Array(bytes),
      ranges: rangeInput,
    })
    const name = defaultOutputName(file.name, 'extracted', 'application/pdf')
    setResult([
      {
        name,
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
        detail: `${parsed.length} page${parsed.length === 1 ? '' : 's'}`,
      },
    ])
  }, [file, rangeInput, parsed.length, validRange, worker])

  const reset = useCallback(() => {
    setFile(null)
    setRangeInput('')
    setResult(null)
  }, [])

  return (
    <Card>
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />
          {pageError && <ErrorAlert message={pageError} />}

          <div>
            <label htmlFor="pages" className="mb-1 block text-sm font-semibold text-slate-700">
              Pages to extract <span className="font-normal text-slate-400">(max {pageCount})</span>
            </label>
            <input
              id="pages"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. 2, 5, 7-10"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            {rangeInput && !validRange && (
              <p className="mt-1 text-xs text-red-600">No valid pages. Use commas and ranges like 1,3,5-8.</p>
            )}
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!validRange} onClick={() => void run()}>
              Extract {validRange ? `${parsed.length} page${parsed.length === 1 ? '' : 's'}` : 'pages'}
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
