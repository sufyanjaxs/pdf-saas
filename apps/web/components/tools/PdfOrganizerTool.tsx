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
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { usePdfPages } from '@/hooks/usePdfPages'
import { defaultOutputName, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { GripVertical, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react'
import { parseRanges } from '@pdf-saas/pdf-engine'

export function PdfOrganizerTool() {
  const [file, setFile] = useState<File | null>(null)
  const [pageOrder, setPageOrder] = useState<number[]>([])
  const [textInput, setTextInput] = useState('')
  const [useTextMode, setUseTextMode] = useState(false)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const { pages, pageCount, loading, error: pageError, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null); releaseResultUrls()
    await load(f)
  }, [load])

  // Initialize page order when pages load
  const initOrder = useCallback(() => {
    if (pageCount > 0 && pageOrder.length === 0) {
      setPageOrder(Array.from({ length: pageCount }, (_, i) => i + 1))
    }
  }, [pageCount, pageOrder.length])

  // Call init when pages change
  if (pageCount > 0 && pageOrder.length === 0 && !useTextMode) {
    setPageOrder(Array.from({ length: pageCount }, (_, i) => i + 1))
  }

  const movePage = useCallback((idx: number, dir: -1 | 1) => {
    setPageOrder((prev) => {
      const next = [...prev]
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= next.length) return prev
      const temp = next[idx]
      next[idx] = next[newIdx]
      next[newIdx] = temp
      return next
    })
  }, [])

  const moveToFront = useCallback((idx: number) => {
    setPageOrder((prev) => {
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.unshift(item)
      return next
    })
  }, [])

  const moveToBack = useCallback((idx: number) => {
    setPageOrder((prev) => {
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.push(item)
      return next
    })
  }, [])

  const resetOrder = useCallback(() => {
    setPageOrder(Array.from({ length: pageCount }, (_, i) => i + 1))
  }, [pageCount])

  const textOrder = useTextMode ? parseRanges(textInput) : pageOrder
  const effectiveOrder = useTextMode ? textOrder : pageOrder

  const run = useCallback(async () => {
    if (!file || effectiveOrder.length === 0) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('reorder', { bytes: new Uint8Array(bytes), order: effectiveOrder })
    setResult([
      {
        name: defaultOutputName(file.name, 'organized', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
        detail: `${effectiveOrder.length} pages`,
      },
    ])
  }, [file, effectiveOrder, worker])

  const reset = useCallback(() => {
    setFile(null)
    setPageOrder([])
    setTextInput('')
    setUseTextMode(false)
    setResult(null); releaseResultUrls()
  }, [])

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} /></div>
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
                <span className="text-xs text-slate-500">{pageOrder.length || effectiveOrder.length} pages in new order</span>
                <button type="button" onClick={resetOrder} className="text-xs font-medium text-brand-600 hover:underline">Reset order</button>
              </div>
              <div className="space-y-1.5">
                {(!useTextMode ? pageOrder : effectiveOrder).map((pageNum, idx) => {
                  const page = pages.find((p) => p.pageNumber === pageNum)
                  if (!page) return null
                  return (
                    <div key={`${pageNum}-${idx}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition-all hover:border-brand-300 hover:shadow-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{idx + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={page.dataUrl} alt={`Page ${pageNum}`} className="h-16 w-12 rounded object-contain shadow-sm" />
                      <span className="flex-1 text-sm text-slate-700">Page {pageNum}</span>
                      {!useTextMode && (
                        <div className="flex items-center gap-0.5">
                          <button type="button" onClick={() => movePage(idx, -1)} disabled={idx === 0}
                            className="rounded p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => movePage(idx, 1)} disabled={idx === pageOrder.length - 1}
                            className="rounded p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => moveToFront(idx)} disabled={idx === 0}
                            className="rounded p-1 text-xs text-slate-400 hover:text-brand-600 disabled:opacity-30">Top</button>
                          <button type="button" onClick={() => moveToBack(idx)} disabled={idx === pageOrder.length - 1}
                            className="rounded p-1 text-xs text-slate-400 hover:text-brand-600 disabled:opacity-30">End</button>
                        </div>
                      )}
                    </div>
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

          <ControlSection title="Mode">
            <div className="flex gap-2">
              <button type="button" onClick={() => setUseTextMode(false)}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm transition-all ${!useTextMode ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                Drag & Drop
              </button>
              <button type="button" onClick={() => setUseTextMode(true)}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm transition-all ${useTextMode ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                Text Input
              </button>
            </div>
          </ControlSection>

          {useTextMode && (
            <ControlSection title="Page Order">
              <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g. 3, 1, 4, 2 or 1-3, 5, 7-9"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              <p className="mt-1 text-xs text-slate-400">Enter page numbers or ranges separated by commas</p>
            </ControlSection>
          )}

          <ControlSection title="Status">
            <div className="space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><span>Total pages</span><span className="font-semibold">{pageCount}</span></div>
              <div className="flex justify-between"><span>Output pages</span><span className="font-semibold">{effectiveOrder.length}</span></div>
              {effectiveOrder.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  New order: {effectiveOrder.slice(0, 5).join(', ')}{effectiveOrder.length > 5 ? '...' : ''}
                </p>
              )}
            </div>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}
          {pageError && <ErrorAlert message={pageError} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!file || effectiveOrder.length === 0 || loading} onClick={() => void run()}>
              Organize Pages
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Organizing pagesâ€¦'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
