'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { usePdfPages } from '@/hooks/usePdfPages'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'
import { Trash2 } from 'lucide-react'

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

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="h-full overflow-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading pages...</div>
          ) : pages.length > 0 ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {selected.size > 0 ? `${selected.size} pages marked for deletion` : 'Click pages to mark for deletion'}
                </span>
                {selected.size > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                    {pageCount - selected.size} pages will remain
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {pages.map((p) => {
                  const isMarked = selected.has(p.pageNumber)
                  return (
                    <button
                      key={p.pageNumber}
                      type="button"
                      onClick={() => togglePage(p.pageNumber)}
                      className={`relative rounded-lg border-2 p-1.5 transition-all ${
                        isMarked ? 'border-red-400 bg-red-50 opacity-60' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.dataUrl} alt={`Page ${p.pageNumber}`}
                        className={`w-full rounded bg-white shadow-sm ${isMarked ? 'line-through' : ''}`} />
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span className={`text-[10px] font-medium ${isMarked ? 'text-red-500' : 'text-slate-500'}`}>{p.pageNumber}</span>
                        {isMarked && <span className="text-[10px] text-red-500">✕</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {pageError || 'Failed to load PDF pages'}
            </div>
          )}
        </div>
      }
      controls={
        <>
          <FileList files={[file]} onRemove={reset} />

          <ControlSection title="Delete Pages">
            <div className="space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><span>Total pages</span><span className="font-semibold">{pageCount}</span></div>
              <div className="flex justify-between"><span>Marked for deletion</span><span className="font-semibold text-red-600">{selected.size}</span></div>
              {selected.size > 0 && (
                <div className="flex justify-between"><span>Will remain</span><span className="font-semibold text-emerald-600">{pageCount - selected.size}</span></div>
              )}
            </div>
          </ControlSection>

          {pageError && <ErrorAlert message={pageError} />}
          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!removable || loading}
              onClick={() => void run()}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete {selected.size} page{selected.size === 1 ? '' : 's'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Deleting pages…'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
