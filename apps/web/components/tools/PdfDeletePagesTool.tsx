'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { PageGrid } from './PageGrid'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePdfPages } from '@/hooks/usePdfPages'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'

export function PdfDeletePagesTool() {
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const { pages, pageCount, loading, error: pageError, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback(
    (files: File[]) => {
      const f = files[0]
      setFile(f)
      setResult(null)
      setSelected(new Set())
      void load(f)
    },
    [load],
  )

  const togglePage = useCallback((page: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(page)) next.delete(page)
      else next.add(page)
      return next
    })
  }, [])

  const run = useCallback(async () => {
    if (!file || selected.size === 0) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('delete-pages', {
      bytes: new Uint8Array(bytes),
      pages: [...selected].sort((a, b) => a - b),
    })
    const name = defaultOutputName(file.name, 'edited', 'application/pdf')
    setResult([
      {
        name,
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
        detail: `Removed ${selected.size} page${selected.size === 1 ? '' : 's'}, kept ${pageCount - selected.size}`,
      },
    ])
  }, [file, selected, pageCount, worker])

  const reset = useCallback(() => {
    setFile(null)
    setSelected(new Set())
    setResult(null)
  }, [])

  const removable = selected.size > 0 && selected.size < pageCount

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          {(loading || pages.length > 0) && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Select pages to delete</h3>
                <span className="text-sm text-slate-500">{selected.size} marked for deletion</span>
              </div>
              <PageGrid pages={pages} selected={selected} onToggle={togglePage} loading={loading} />
            </div>
          )}

          {pageError && <ErrorAlert message={pageError} />}
          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button
              size="lg"
              loading={worker.running}
              disabled={!removable || loading}
              onClick={() => void run()}
            >
              Delete {selected.size} page{selected.size === 1 ? '' : 's'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Deleting pages…'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
