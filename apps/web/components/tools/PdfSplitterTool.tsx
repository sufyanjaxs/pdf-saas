'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { PdfResultView } from './PdfResultView'
import { ErrorAlert } from './ErrorAlert'
import { PageGrid } from './PageGrid'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePdfPages } from '@/hooks/usePdfPages'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName } from '@/lib/client-utils'

export function PdfSplitterTool() {
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<{ name: string; blob: Blob; size: number; pageCount: number } | null>(
    null,
  )
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

  const allSelected = pageCount > 0 && selected.size === pageCount

  const run = useCallback(async () => {
    if (!file || selected.size === 0) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('split', {
      bytes: new Uint8Array(bytes),
      pages: [...selected].sort((a, b) => a - b),
    })
    const blob = new Blob([res.bytes as BlobPart], { type: 'application/pdf' })
    setResult({
      name: defaultOutputName(file.name, 'split', 'application/pdf'),
      blob,
      size: blob.size,
      pageCount: selected.size,
    })
  }, [file, selected, worker])

  const reset = useCallback(() => {
    setFile(null)
    setSelected(new Set())
    setResult(null)
  }, [])

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} />
      ) : result ? (
        <PdfResultView
          name={result.name}
          file={result.blob}
          size={result.size}
          pageCount={result.pageCount}
          detail={`${selected.size}/${pageCount} pages kept`}
          onReset={reset}
        />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          {(loading || pages.length > 0) && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Select pages to keep</h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">{selected.size} / {pageCount} selected</span>
                  <button
                    type="button"
                    className="font-medium text-brand-600 hover:underline"
                    onClick={() => {
                      if (allSelected) setSelected(new Set())
                      else setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)))
                    }}
                  >
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                </div>
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
              disabled={!file || selected.size === 0 || loading}
              onClick={() => void run()}
            >
              Split PDF
            </Button>
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && (
            <ProcessingOverlay label={worker.label || 'Processing…'} progress={worker.progress} onCancel={worker.cancel} />
          )}
        </div>
      )}
    </Card>
  )
}
