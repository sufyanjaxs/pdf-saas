'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { PdfResultView } from './PdfResultView'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection, OptionButton } from './ToolWorkspace'
import { usePdfPages } from '@/hooks/usePdfPages'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName } from '@/lib/client-utils'

type SplitMode = 'select' | 'range' | 'every'

export function PdfSplitterTool() {
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<SplitMode>('select')
  const [rangeFrom, setRangeFrom] = useState('1')
  const [rangeTo, setRangeTo] = useState('')
  const [everyN, setEveryN] = useState('2')
  const [result, setResult] = useState<{ name: string; blob: Blob; size: number; pageCount: number } | null>(null)
  const { pages, pageCount, loading, error: pageError, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null)
    setSelected(new Set())
    setRangeTo(String(pageCount || ''))
    void load(f)
  }, [load, pageCount])

  const togglePage = useCallback((page: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(page)) next.delete(page)
      else next.add(page)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)))
  }, [pageCount])

  const clearAll = useCallback(() => setSelected(new Set()), [])

  // Compute pages based on mode
  const computePages = useCallback((): number[] => {
    if (mode === 'select') return [...selected].sort((a, b) => a - b)
    if (mode === 'range') {
      const from = parseInt(rangeFrom, 10) || 1
      const to = parseInt(rangeTo, 10) || pageCount
      return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i).filter((p) => p >= 1 && p <= pageCount)
    }
    if (mode === 'every') {
      const n = parseInt(everyN, 10) || 2
      return Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p % n === 1)
    }
    return []
  }, [mode, selected, rangeFrom, rangeTo, everyN, pageCount])

  const targetPages = computePages()

  const run = useCallback(async () => {
    if (!file || targetPages.length === 0) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('split', {
      bytes: new Uint8Array(bytes),
      pages: targetPages,
    })
    const blob = new Blob([res.bytes as BlobPart], { type: 'application/pdf' })
    setResult({
      name: defaultOutputName(file.name, 'split', 'application/pdf'),
      blob,
      size: blob.size,
      pageCount: targetPages.length,
    })
  }, [file, targetPages, worker])

  const reset = useCallback(() => {
    setFile(null); setSelected(new Set()); setResult(null)
    setMode('select'); setRangeFrom('1'); setRangeTo(''); setEveryN('2')
  }, [])

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} /></div>
  }
  if (result) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PdfResultView name={result.name} file={result.blob} size={result.size} pageCount={result.pageCount} detail={`${targetPages.length} of ${pageCount} pages kept`} onReset={reset} />
      </div>
    )
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{targetPages.length} of {pageCount} pages will be kept</span>
                  {targetPages.length > 0 && targetPages.length < pageCount && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                      {((targetPages.length / pageCount) * 100).toFixed(0)}% selected
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAll} className="text-xs font-medium text-brand-600 hover:underline">Select all</button>
                  <button type="button" onClick={clearAll} className="text-xs font-medium text-slate-500 hover:underline">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {pages.map((p) => {
                  const isSelected = selected.has(p.pageNumber)
                  const inRange = targetPages.includes(p.pageNumber)
                  const order = targetPages.indexOf(p.pageNumber) + 1
                  return (
                    <button
                      key={p.pageNumber}
                      type="button"
                      onClick={() => { setMode('select'); togglePage(p.pageNumber) }}
                      className={`relative rounded-lg border-2 p-1.5 transition-all ${
                        mode === 'select' && isSelected
                          ? 'border-brand-600 bg-brand-50 shadow-sm'
                          : mode !== 'select' && inRange
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.dataUrl} alt={`Page ${p.pageNumber}`} className="w-full rounded bg-white shadow-sm" />
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span className="text-center text-[10px] font-medium text-slate-500">{p.pageNumber}</span>
                        {(mode === 'select' && isSelected) && (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white">{order}</span>
                        )}
                        {(mode !== 'select' && inRange) && (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">{order}</span>
                        )}
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

          <ControlSection title="Split Mode">
            <div className="flex flex-wrap gap-2">
              <OptionButton selected={mode === 'select'} onClick={() => setMode('select')}>Select Pages</OptionButton>
              <OptionButton selected={mode === 'range'} onClick={() => setMode('range')}>Page Range</OptionButton>
              <OptionButton selected={mode === 'every'} onClick={() => setMode('every')}>Every N Pages</OptionButton>
            </div>
          </ControlSection>

          {mode === 'range' && (
            <ControlSection title="Page Range">
              <div className="flex items-center gap-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">From</label>
                  <input type="number" min={1} max={pageCount} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}
                    className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
                </div>
                <span className="mt-5 text-slate-400">—</span>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">To</label>
                  <input type="number" min={1} max={pageCount} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}
                    className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Pages {rangeFrom || 1} to {rangeTo || pageCount} = {targetPages.length} page{targetPages.length === 1 ? '' : 's'}
              </p>
            </ControlSection>
          )}

          {mode === 'every' && (
            <ControlSection title="Every N Pages">
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Every</label>
                <input type="number" min={2} max={pageCount} value={everyN} onChange={(e) => setEveryN(e.target.value)}
                  className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
                <label className="text-sm text-slate-600">page(s) = {targetPages.length} pages</label>
              </div>
            </ControlSection>
          )}

          <ControlSection title="Selection">
            <div className="text-sm text-slate-600">
              <div className="flex justify-between"><span>Selected pages</span><span className="font-semibold">{targetPages.length}</span></div>
              <div className="flex justify-between"><span>Total pages</span><span className="font-semibold">{pageCount}</span></div>
              {targetPages.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  Output: {targetPages.length === pageCount ? 'All pages' : `Pages ${targetPages[0]}${targetPages.length > 2 ? '...' : ''}${targetPages[targetPages.length - 1]}`}
                </p>
              )}
            </div>
          </ControlSection>

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!file || targetPages.length === 0 || loading} onClick={() => void run()}>
              Split PDF
            </Button>
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Processing...'} progress={worker.progress} onCancel={worker.cancel} />}
          {worker.error && <ErrorAlert message={worker.error} />}
          {pageError && <ErrorAlert message={pageError} />}
        </>
      }
    />
  )
}
