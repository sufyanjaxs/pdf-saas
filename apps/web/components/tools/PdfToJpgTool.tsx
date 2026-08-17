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
import { pdfToJpeg } from '@/lib/pdfjs'
import { formatBytes } from '@pdf-saas/file-utils'

type Scope = 'all' | 'selected'

export function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null)
  const [scope, setScope] = useState<Scope>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const { pages, pageCount, loading, error: pageError, load } = usePdfPages()

  const onFiles = useCallback(
    (files: File[]) => {
      const f = files[0]
      setFile(f)
      setResult(null)
      setError(null)
      setSelected(new Set())
      setScope('all')
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

  const targets = scope === 'all' ? (pageCount > 0 ? Array.from({ length: pageCount }, (_, i) => i + 1) : []) : [...selected].sort((a, b) => a - b)

  const run = useCallback(async () => {
    if (!file || targets.length === 0) return
    setResult(null)
    setError(null)
    setProgress(0)
    try {
      const bytes = await file.arrayBuffer()
      const outputs = await pdfToJpeg(bytes, {
        pages: targets,
        scale: 2,
        quality: 0.92,
        onProgress: setProgress,
      })
      const base = file.name.replace(/\.pdf$/i, '')
      const items: ResultItem[] = outputs.map((o) => ({
        name: `${base}-page-${o.pageNumber}.jpg`,
        url: URL.createObjectURL(o.blob),
        size: o.blob.size,
      }))
      setResult(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert PDF to JPG')
    } finally {
      setProgress(null)
    }
  }, [file, targets, pageCount])

  const reset = useCallback(() => {
    setFile(null)
    setSelected(new Set())
    setResult(null)
    setError(null)
  }, [])

  const running = progress !== null

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} className="text-brand-600" />
              All pages ({pageCount})
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" checked={scope === 'selected'} onChange={() => setScope('selected')} className="text-brand-600" />
              Selected pages ({selected.size})
            </label>
          </div>

          {scope === 'selected' && (loading || pages.length > 0) && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Pick pages to export</h3>
              <PageGrid pages={pages} selected={selected} onToggle={togglePage} loading={loading} />
            </div>
          )}

          {(pageError || error) && <ErrorAlert message={pageError || error || ''} />}

          <div className="flex items-center gap-3">
            <Button
              size="lg"
              loading={running}
              disabled={targets.length === 0 || loading}
              onClick={() => void run()}
            >
              Convert {targets.length > 0 ? `${targets.length} page${targets.length === 1 ? '' : 's'}` : ''}
            </Button>
          </div>
          <ProgressBar value={progress} label="Rendering pages…" />
          {running && <ProcessingOverlay label="Converting PDF to JPG…" progress={progress} />}

          {result && (
            <ResultPanel
              items={result}
              summary={`${result.length} JPG${result.length === 1 ? '' : 's'} · ${formatBytes(result.reduce((s, r) => s + r.size, 0))} total`}
              onReset={reset}
            />
          )}
        </div>
      )}
    </Card>
  )
}
