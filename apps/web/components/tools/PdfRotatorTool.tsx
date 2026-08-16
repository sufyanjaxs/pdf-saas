'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { PageGrid } from './PageGrid'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePdfPages } from '@/hooks/usePdfPages'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'

type Rotation = 90 | 180 | 270

export function PdfRotatorTool() {
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [allPages, setAllPages] = useState(true)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const { pages, pageCount, loading, error: pageError, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback(
    (files: File[]) => {
      const f = files[0]
      setFile(f)
      setResult(null)
      setSelected(new Set())
      setAllPages(true)
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

  const run = useCallback(
    async (degrees: Rotation) => {
      if (!file) return
      const pagesToRotate = allPages ? [] : [...selected].sort((a, b) => a - b)
      if (!allPages && pagesToRotate.length === 0) return
      const bytes = await file.arrayBuffer()
      const res = await worker.run('rotate', {
        bytes: new Uint8Array(bytes),
        pages: pagesToRotate,
        degrees,
      })
      const name = defaultOutputName(file.name, `rotated-${degrees}`, 'application/pdf')
      setResult([
        {
          name,
          url: resultBlobUrl('application/pdf', res.bytes),
          size: res.bytes.byteLength,
          detail: allPages ? `All ${pageCount} pages` : `${pagesToRotate.length} pages`,
        },
      ])
    },
    [file, allPages, selected, pageCount, worker],
  )

  const reset = useCallback(() => {
    setFile(null)
    setSelected(new Set())
    setResult(null)
  }, [])

  return (
    <Card>
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={allPages}
                onChange={() => setAllPages(true)}
                className="text-brand-600"
              />
              All pages
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={!allPages}
                onChange={() => setAllPages(false)}
                className="text-brand-600"
              />
              Selected pages ({selected.size})
            </label>
          </div>

          {!allPages && (loading || pages.length > 0) && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Pick pages to rotate</h3>
              <PageGrid pages={pages} selected={selected} onToggle={togglePage} loading={loading} />
            </div>
          )}

          {pageError && <ErrorAlert message={pageError} />}
          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={worker.running || (!allPages && selected.size === 0)}
              loading={worker.running}
              onClick={() => void run(90)}
            >
              Rotate 90°
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={worker.running || (!allPages && selected.size === 0)}
              onClick={() => void run(180)}
            >
              Rotate 180°
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={worker.running || (!allPages && selected.size === 0)}
              onClick={() => void run(270)}
            >
              Rotate 270°
            </Button>
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
