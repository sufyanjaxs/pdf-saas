'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { resultBlobUrl } from '@/lib/client-utils'

const ACCEPT = 'image/jpeg,image/png,image/webp'

type PageSize = 'a4' | 'letter' | 'original' | 'fit'
type Orientation = 'portrait' | 'landscape' | 'auto'

const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

export function JpgToPdfTool() {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [pageSize, setPageSize] = useState<PageSize>('a4')
  const [orientation, setOrientation] = useState<Orientation>('auto')
  const [margin, setMargin] = useState(12)
  const [fitMode, setFitMode] = useState<'contain' | 'fill'>('contain')
  const worker = usePdfWorker()

  const move = useCallback((index: number, dir: -1 | 1) => {
    setFiles((prev) => { const next = [...prev]; const j = index + dir; if (j < 0 || j >= next.length) return prev; [next[index], next[j]] = [next[j], next[index]]; return next })
  }, [])

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const arrays = await Promise.all(files.map((f) => f.arrayBuffer()))
    const res = await worker.run('images-to-pdf', {
      files: arrays.map((b) => new Uint8Array(b)),
      mimes: files.map((f) => f.type),
      pageSize: pageSize === 'original' ? undefined : PAGE_SIZES[pageSize],
      orientation,
      margin,
      fitMode,
    } as any)
    const name = `images-${files.length}-pages.pdf`
    setResult([{ name, url: resultBlobUrl('application/pdf', res.bytes), size: res.bytes.byteLength, detail: `${files.length} image${files.length === 1 ? '' : 's'} | ${pageSize.toUpperCase()} ${orientation === 'auto' ? '' : orientation}` }])
  }, [files, worker, pageSize, orientation, margin, fitMode])

  const reset = useCallback(() => { setFiles([]); setResult(null) }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} hint="Drop JPG, PNG or WEBP images, or browse" onFiles={(incoming) => setFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">{files.length} image{files.length === 1 ? '' : 's'}</h3>
              <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={reset}>Change images</button>
            </div>
            <FileList files={files} reorderable onMove={move} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Page Size</h3>
              <div className="flex flex-wrap gap-2">
                {(['a4', 'letter', 'original', 'fit'] as PageSize[]).map((ps) => (
                  <button key={ps} type="button" onClick={() => setPageSize(ps)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      pageSize === ps ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                    }`}>{ps === 'a4' ? 'A4' : ps === 'letter' ? 'US Letter' : ps === 'original' ? 'Original Size' : 'Fit to Image'}</button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Orientation</h3>
              <div className="flex gap-2">
                {(['auto', 'portrait', 'landscape'] as Orientation[]).map((o) => (
                  <button key={o} type="button" onClick={() => setOrientation(o)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      orientation === o ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                    }`}>{o}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Margins</h3>
              <div className="flex gap-2">
                {[0, 8, 12, 24, 36].map((m) => (
                  <button key={m} type="button" onClick={() => setMargin(m)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                      margin === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                    }`}>{m === 0 ? 'None' : `${m}pt`}</button>
                ))}
              </div>
            </div>
            {pageSize !== 'fit' && pageSize !== 'original' && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Image Fit</h3>
                <div className="flex gap-2">
                  {(['contain', 'fill'] as const).map((fm) => (
                    <button key={fm} type="button" onClick={() => setFitMode(fm)}
                      className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        fitMode === fm ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                      }`}>{fm === 'contain' ? 'Fit Inside' : 'Fill Page'}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>Create PDF</Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Creating PDF...'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
