'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'
type OutputFormat = 'jpg' | 'png' | 'webp' | 'gif'

const FORMATS: { id: OutputFormat; label: string; mime: string; desc: string; supportsAlpha: boolean }[] = [
  { id: 'jpg', label: 'JPEG', mime: 'image/jpeg', desc: 'Best for photos, small size, no transparency', supportsAlpha: false },
  { id: 'png', label: 'PNG', mime: 'image/png', desc: 'Lossless, supports transparency', supportsAlpha: true },
  { id: 'webp', label: 'WebP', mime: 'image/webp', desc: 'Modern format, small + quality, partial alpha', supportsAlpha: true },
  { id: 'gif', label: 'GIF', mime: 'image/gif', desc: 'Best for simple animations and graphics', supportsAlpha: true },
]

function getFormatInfo(ext: string) {
  return FORMATS.find((f) => f.id === ext.toLowerCase().replace('jpeg', 'jpg'))
}

export function ImageConverterTool() {
  const [files, setFiles] = useState<File[]>([])
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpg')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const targetFormat = FORMATS.find((f) => f.id === outputFormat)!
  const inputFormats = files.map((f) => f.name.split('.').pop()?.toLowerCase().replace('jpeg', 'jpg') ?? '')
  const hasTransparency = files.some((f) => ['png', 'webp', 'gif'].some((ext) => f.name.toLowerCase().endsWith(ext)))
  const willLooseAlpha = hasTransparency && !targetFormat.supportsAlpha

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('convert', {
      files: payloads, opts: { format: targetFormat.mime }
    })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size,
      detail: `${r.width}×${r.height}px | ${targetFormat.label}`
    }))
    setResult(items)
  }, [files, targetFormat, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null) }, [])

  return (
    <Card className="relative">
      {!result ? (
        <>
          {files.length === 0 ? (
            <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => setFiles(incoming)} />
          ) : (
            <div className="space-y-6">
              <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

              {/* Current format badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Current:</span>
                {files.map((f, i) => {
                  const ext = f.name.split('.').pop()?.toLowerCase().replace('jpeg', 'jpg') ?? ''
                  const info = getFormatInfo(ext)
                  return (
                    <span key={i} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {info?.label ?? ext.toUpperCase()}
                    </span>
                  )
                })}
              </div>

              {/* Output format */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Convert to</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FORMATS.map((fmt) => (
                    <button key={fmt.id} type="button" onClick={() => setOutputFormat(fmt.id)}
                      className={`rounded-xl border-2 px-3 py-3 text-left transition-all ${
                        outputFormat === fmt.id ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                      }`}>
                      <span className={`block text-sm font-bold ${outputFormat === fmt.id ? 'text-brand-700' : 'text-slate-700'}`}>{fmt.label}</span>
                      <span className="block text-[10px] text-slate-400 leading-tight mt-0.5">{fmt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transparency warning */}
              {willLooseAlpha && (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Transparency will be removed</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Your image has transparency (PNG/WebP), but JPEG does not support it.
                      Transparent areas will become solid white. Use PNG or WebP to preserve transparency.
                    </p>
                  </div>
                </div>
              )}

              {/* Format compatibility */}
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-600 mb-2">Format Details</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>Output: <span className="font-medium text-slate-700">{targetFormat.label}</span></div>
                  <div>Transparency: <span className="font-medium text-slate-700">{targetFormat.supportsAlpha ? 'Yes' : 'No'}</span></div>
                </div>
              </div>

              {worker.error && <ErrorAlert message={worker.error} />}

              <div className="flex items-center gap-3">
                <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
                  <ArrowRight className="mr-1 h-4 w-4" /> Convert to {targetFormat.label}
                </Button>
                {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
              </div>
              {worker.running && <ProcessingOverlay label={worker.label || 'Converting...'} progress={worker.progress} onCancel={worker.cancel} />}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <ResultPanel items={result} onReset={reset} />
        </div>
      )}
    </Card>
  )
}
