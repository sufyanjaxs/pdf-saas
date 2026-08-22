'use client'

import { useCallback, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'
import { ShieldCheck, Zap, Target } from 'lucide-react'

type Level = 'balanced' | 'strong' | 'maximum'

const LEVELS: { id: Level; name: string; description: string; icon: React.ReactNode; quality: string; sizeNote: string }[] = [
  { id: 'balanced', name: 'Balanced', description: 'Lossless cleanup â€” removes metadata and unused objects', icon: <ShieldCheck className="h-5 w-5" />, quality: 'High', sizeNote: '5-15% smaller' },
  { id: 'strong', name: 'Strong', description: 'Re-encodes embedded photos at ~72% JPEG quality', icon: <Zap className="h-5 w-5" />, quality: 'Good', sizeNote: '20-40% smaller' },
  { id: 'maximum', name: 'Maximum', description: 'Re-encodes embedded photos at ~50% JPEG quality', icon: <Target className="h-5 w-5" />, quality: 'Fair', sizeNote: '40-60% smaller' },
]

export function PdfCompressorTool() {
  const [file, setFile] = useState<File | null>(null)
  const [level, setLevel] = useState<Level>('balanced')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const worker = usePdfWorker()
  const previewRef = useRef<HTMLCanvasElement>(null)

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null); releaseResultUrls()
    setPageCount(0)
    // Get page count via pdf.js
    try {
      const { loadPdfDocument } = await import('@/lib/pdfjs')
      const bytes = await f.arrayBuffer()
      const doc = await loadPdfDocument(new Uint8Array(bytes))
      setPageCount(doc.numPages)
    } catch { /* ignore */ }
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    setResult(null); releaseResultUrls()
    const bytes = await file.arrayBuffer()
    const res = await worker.run('compress', {
      bytes: new Uint8Array(bytes),
      level,
    })
    if (res.kind !== 'compress') return
    const saved = Math.max(0, Math.round((1 - res.compressedSize / res.originalSize) * 100))
    const name = defaultOutputName(file.name, `compressed-${level}`, 'application/pdf')
    setResult([
      {
        name,
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.compressedSize,
        detail: `${formatBytes(res.originalSize)} â†’ ${formatBytes(res.compressedSize)} Â· saved ${saved}%`,
      },
    ])
  }, [file, level, worker])

  const reset = useCallback(() => {
    setFile(null)
    setResult(null); releaseResultUrls()
    setPageCount(0)
  }, [])

  const currentLevel = LEVELS.find((l) => l.id === level)!

  return (
    <ToolWorkspace
      preview={
        <div className="flex h-full flex-col items-center justify-center p-6">
          {file ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
                <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">{file.name}</p>
              <p className="mt-1 text-xs text-slate-400">{formatBytes(file.size)}{pageCount > 0 && ` Â· ${pageCount} pages`}</p>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Typical result on photo-heavy PDFs</p>
                <p className="mt-1 text-lg font-bold text-brand-600">{currentLevel.sizeNote}</p>
                <p className="text-xs text-slate-400">Quality: {currentLevel.quality}</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-slate-400">
              Upload a PDF to see compression options
            </div>
          )}
        </div>
      }
      controls={
        <>
          {file && <FileList files={[file]} onRemove={reset} />}

          <ControlSection title="Compression Level">
            <div className="space-y-3">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLevel(l.id)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    level === l.id ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={level === l.id ? 'text-brand-600' : 'text-slate-400'}>{l.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{l.name}</p>
                      <p className="text-xs text-slate-500">{l.description}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      level === l.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
                    }`}>{l.sizeNote}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
              Text and vector content is always preserved. Only images may lose quality at higher compression levels.
            </div>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!file} onClick={() => void run()}>
              Compress PDF
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Compressing PDF...'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </>
      }
    />
  )
}
