'use client'

import { useCallback, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'
import { renderThumbnails } from '@/lib/pdfjs'
import { GripVertical, X, Plus, FileText } from 'lucide-react'

interface FileWithThumbs {
  file: File
  thumbs: string[]
  pageCount: number
}

export function PdfMergerTool() {
  const [files, setFiles] = useState<FileWithThumbs[]>([])
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback(async (incoming: File[]) => {
    const withThumbs: FileWithThumbs[] = []
    for (const f of incoming) {
      try {
        const bytes = await f.arrayBuffer()
        const thumbs = await renderThumbnails(bytes, 120)
        withThumbs.push({ file: f, thumbs: thumbs.map((t) => t.dataUrl), pageCount: thumbs.length })
      } catch {
        withThumbs.push({ file: f, thumbs: [], pageCount: 0 })
      }
    }
    setFiles((prev) => [...prev, ...withThumbs])
    setResult(null)
  }, [])

  const move = useCallback((index: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }, [])

  const remove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, j) => j !== index))
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIdx(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIdx === null || dragIdx === index) return
    setFiles((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(index, 0, moved)
      return next
    })
    setDragIdx(index)
  }, [dragIdx])

  const handleDragEnd = useCallback(() => {
    setDragIdx(null)
  }, [])

  const totalPages = files.reduce((s, f) => s + f.pageCount, 0)
  const totalSize = files.reduce((s, f) => s + f.file.size, 0)

  const run = useCallback(async () => {
    if (files.length < 2) return
    setResult(null)
    const arrays = await Promise.all(files.map((f) => f.file.arrayBuffer()))
    const res = await worker.run('merge', { files: arrays.map((b) => new Uint8Array(b)) })
    const name = `merged-${files.length}-files-${totalPages}-pages.pdf`
    setResult([{ name, url: resultBlobUrl('application/pdf', res.bytes), size: res.bytes.byteLength, detail: `${files.length} files — ${totalPages} pages` }])
  }, [files, worker, totalPages])

  const reset = useCallback(() => { setFiles([]); setResult(null) }, [])

  if (files.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" multiple maxSizeMB={200} minFiles={2} hint="Drop 2 or more PDF files, or browse" onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      summary={
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-700">{files.length} files</span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">{totalPages} pages</span>
          </div>
        </div>
      }
      preview={
        <div className="h-full overflow-auto p-4">
          <div className="mb-3 text-center text-xs text-slate-400">
            Drag to reorder — final merge order shown below
          </div>
          <div className="space-y-3">
            {files.map((f, fi) => (
              <div
                key={fi}
                draggable
                onDragStart={(e) => handleDragStart(e, fi)}
                onDragOver={(e) => handleDragOver(e, fi)}
                onDragEnd={handleDragEnd}
                className={`rounded-xl border-2 bg-white p-3 shadow-sm transition-all ${
                  dragIdx === fi ? 'border-brand-400 shadow-md opacity-80' : 'border-slate-200'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 cursor-grab text-slate-300 active:cursor-grabbing" />
                  <span className="flex-1 truncate text-sm font-medium text-slate-700">{f.file.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {f.pageCount} page{f.pageCount === 1 ? '' : 's'}
                  </span>
                  <button type="button" onClick={() => remove(fi)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="pdf-thumb-strip">
                  {f.thumbs.map((thumb, ti) => (
                    <div key={ti} className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb} alt={`Page ${ti + 1}`} className="h-16 rounded bg-white shadow-sm" />
                      <span className="absolute bottom-0.5 right-1 rounded bg-black/50 px-1 text-[9px] text-white">{ti + 1}</span>
                    </div>
                  ))}
                  {f.thumbs.length === 0 && (
                    <div className="flex h-16 items-center justify-center rounded bg-slate-100 px-4 text-xs text-slate-400">
                      Preview unavailable
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/pdf'; input.multiple = true; input.onchange = (e) => { const files = (e.target as HTMLInputElement).files; if (files) onFiles(Array.from(files)) }; input.click() }}
              className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-600"
            >
              <Plus className="h-4 w-4" />
              Add more PDFs
            </button>
          </div>
        </div>
      }
      controls={
        <>
          <ControlSection title="Merge Order">
            <div className="space-y-2 text-sm text-slate-600">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate">{f.file.name}</span>
                  <span className="text-xs text-slate-400">{f.pageCount}p</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Files will be merged top to bottom. Drag in the preview to reorder.
            </div>
          </ControlSection>

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length < 2} onClick={() => void run()}>
              Merge {files.length} PDFs → {totalPages} pages
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Merging PDFs...'} progress={worker.progress} onCancel={worker.cancel} />}
          {worker.error && <ErrorAlert message={worker.error} />}
        </>
      }
    />
  )
}
