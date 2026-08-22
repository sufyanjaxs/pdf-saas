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
import { defaultOutputName, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { parsePageRanges } from '@pdf-saas/file-utils'
import { Scissors } from 'lucide-react'

const QUICK_RANGES = [
  { label: 'First page', value: '1' },
  { label: 'Last page', value: '{last}' },
  { label: 'Odd pages', value: 'odd' },
  { label: 'Even pages', value: 'even' },
]

export function PdfExtractorTool() {
  const [file, setFile] = useState<File | null>(null)
  const [rangeInput, setRangeInput] = useState('')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const { pages, pageCount, loading, error: pageError, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null); releaseResultUrls()
    setRangeInput('')
    await load(f)
  }, [load])

  // Expand quick-range tokens ('{last}', 'odd', 'even') into explicit page
  // lists. This ONE expanded string drives both the live preview and the
  // worker payload — sending the raw tokens would crash engine parsing.
  const expandedRange = file
    ? rangeInput
        .replace('{last}', String(pageCount))
        .replace(/odd/g, () =>
          Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p % 2 === 1).join(','))
        .replace(/even/g, () =>
          Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p % 2 === 0).join(','))
    : ''
  const parsed = file ? parsePageRanges(expandedRange, pageCount) : []
  const validRange = parsed.length > 0 && parsed.length <= pageCount

  const run = useCallback(async () => {
    if (!file || !validRange) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('extract', {
      bytes: new Uint8Array(bytes),
      ranges: expandedRange,
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
  }, [file, expandedRange, parsed.length, validRange, worker])

  const reset = useCallback(() => {
    setFile(null)
    setRangeInput('')
    setResult(null); releaseResultUrls()
  }, [])

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
                  {validRange ? `${parsed.length} pages selected for extraction` : 'Enter a page range to preview'}
                </span>
                {validRange && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                    {((parsed.length / pageCount) * 100).toFixed(0)}% of document
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {pages.map((p) => {
                  const isSelected = parsed.includes(p.pageNumber)
                  return (
                    <div key={p.pageNumber} className={`relative rounded-lg border-2 p-1.5 transition-all ${
                      isSelected ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 opacity-50'
                    }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.dataUrl} alt={`Page ${p.pageNumber}`} className="w-full rounded bg-white shadow-sm" />
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <span className={`text-[10px] font-medium ${isSelected ? 'text-brand-700' : 'text-slate-400'}`}>{p.pageNumber}</span>
                        {isSelected && <span className="text-[10px] text-brand-600">âœ“</span>}
                      </div>
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

          <ControlSection title="Pages to Extract">
            <div className="space-y-3">
              <input
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                placeholder="e.g. 2, 5, 7-10"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              {rangeInput && !validRange && (
                <p className="text-xs text-red-600">No valid pages. Use commas and ranges like 1,3,5-8.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {QUICK_RANGES.map((qr) => {
                  const val = qr.value === '{last}' ? String(pageCount) : qr.value
                  return (
                    <button key={qr.label} type="button"
                      onClick={() => setRangeInput(rangeInput ? `${rangeInput}, ${val}` : val)}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200">
                      {qr.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </ControlSection>

          {pageError && <ErrorAlert message={pageError} />}
          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!validRange} onClick={() => void run()}>
              <Scissors className="mr-1 h-4 w-4" /> Extract {validRange ? `${parsed.length} page${parsed.length === 1 ? '' : 's'}` : 'pages'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Extracting pagesâ€¦'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
