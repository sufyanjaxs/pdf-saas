'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { PdfResultView } from './PdfResultView'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { usePdfPages } from '@/hooks/usePdfPages'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName } from '@/lib/client-utils'
import { RotateCw, RotateCcw } from 'lucide-react'

export function PdfRotatorTool() {
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [rotations, setRotations] = useState<Map<number, number>>(new Map())
  const [result, setResult] = useState<{ name: string; blob: Blob; size: number; pageCount: number } | null>(null)
  const { pages, pageCount, loading, error: pageError, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    const f = files[0]
    setFile(f); setResult(null); setSelected(new Set()); setRotations(new Map())
    void load(f)
  }, [load])

  const togglePage = useCallback((page: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(page)) next.delete(page)
      else next.add(page)
      return next
    })
  }, [])

  const selectAll = useCallback(() => setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i + 1))), [pageCount])
  const clearAll = useCallback(() => setSelected(new Set()), [])

  const rotatePages = useCallback((degrees: number) => {
    setRotations((prev) => {
      const next = new Map(prev)
      const pagesToRotate = selected.size > 0 ? [...selected] : Array.from({ length: pageCount }, (_, i) => i + 1)
      for (const p of pagesToRotate) {
        next.set(p, ((next.get(p) || 0) + degrees + 360) % 360)
      }
      return next
    })
  }, [selected, pageCount])

  const run = useCallback(async () => {
    if (!file) return
    const bytes = await file.arrayBuffer()
    // Use the largest rotation for each page
    const pageRotations: Record<number, number> = {}
    rotations.forEach((v, k) => { if (v % 360 !== 0) pageRotations[k] = v % 360 })
    const res = await worker.run('rotate', {
      bytes: new Uint8Array(bytes),
      rotations: pageRotations,
    } as any)
    const blob = new Blob([res.bytes as BlobPart], { type: 'application/pdf' })
    setResult({
      name: defaultOutputName(file.name, 'rotated', 'application/pdf'),
      blob, size: blob.size, pageCount,
    })
  }, [file, rotations, worker, pageCount])

  const reset = useCallback(() => { setFile(null); setSelected(new Set()); setRotations(new Map()); setResult(null) }, [])

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} /></div>
  }
  if (result) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PdfResultView name={result.name} file={result.blob} size={result.size} pageCount={result.pageCount} detail="Rotated" onReset={reset} />
      </div>
    )
  }

  const hasRotations = [...rotations.values()].some((v) => v % 360 !== 0)

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
                  {selected.size > 0 ? `${selected.size} selected` : 'Click pages to select, then rotate'}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAll} className="text-xs font-medium text-brand-600 hover:underline">Select all</button>
                  <button type="button" onClick={clearAll} className="text-xs font-medium text-slate-500 hover:underline">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {pages.map((p) => {
                  const rot = rotations.get(p.pageNumber) || 0
                  const isSelected = selected.has(p.pageNumber)
                  return (
                    <button
                      key={p.pageNumber}
                      type="button"
                      onClick={() => togglePage(p.pageNumber)}
                      className={`relative rounded-lg border-2 p-1.5 transition-all ${
                        isSelected ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="overflow-hidden rounded bg-white shadow-sm" style={{ transform: `rotate(${rot}deg)`, transition: 'transform 0.3s ease' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.dataUrl} alt={`Page ${p.pageNumber}`} className="w-full" />
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-slate-500">{p.pageNumber}</span>
                        {rot !== 0 && <span className="text-[10px] text-brand-600">{rot}°</span>}
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

          <ControlSection title="Rotate">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => rotatePages(-90)} className="flex-1">
                <RotateCcw className="mr-1 h-4 w-4" /> Left 90°
              </Button>
              <Button variant="outline" onClick={() => rotatePages(90)} className="flex-1">
                <RotateCw className="mr-1 h-4 w-4" /> Right 90°
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => rotatePages(180)} className="flex-1">180°</Button>
              <Button variant="ghost" onClick={() => setRotations(new Map())} className="flex-1">Reset rotations</Button>
            </div>
          </ControlSection>

          <ControlSection title="Status">
            <div className="space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><span>Total pages</span><span className="font-semibold">{pageCount}</span></div>
              <div className="flex justify-between"><span>Rotated pages</span><span className="font-semibold">{[...rotations.values()].filter((v) => v % 360 !== 0).length}</span></div>
            </div>
          </ControlSection>

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!file || !hasRotations} onClick={() => void run()}>
              Apply Rotation
            </Button>
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Rotating pages...'} progress={worker.progress} onCancel={worker.cancel} />}
          {worker.error && <ErrorAlert message={worker.error} />}
          {pageError && <ErrorAlert message={pageError} />}
        </>
      }
    />
  )
}
