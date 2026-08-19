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
import { Eraser, Eye, EyeOff, Maximize2, Download } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'

export function BackgroundRemoverTool() {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const worker = useImageWorker()

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('remove-background', { files: payloads })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size,
      detail: `${r.width}×${r.height}px | Transparent PNG`
    }))
    setResult(items)
  }, [files, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); setShowOriginal(false); setPreviewIndex(0) }, [])

  return (
    <Card className="relative">
      {!result ? (
        <>
          {files.length === 0 ? (
            <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => setFiles(incoming)}
              hint="Works best with clear subjects on solid or simple backgrounds" />
          ) : (
            <div className="space-y-6">
              <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

              {/* Preview grid */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Original Preview</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {files.map((f, i) => (
                    <button key={i} type="button" onClick={() => setPreviewIndex(i)}
                      className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                        previewIndex === i ? 'border-brand-600 shadow-md' : 'border-slate-200 hover:border-brand-300'
                      }`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">{i + 1}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkerboard transparency preview */}
              <div className="flex justify-center">
                <CheckerboardPreview file={files[previewIndex]} />
              </div>

              {/* Info */}
              <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Background removal runs entirely in your browser — no image is sent to any server.
              </div>

              {worker.error && <ErrorAlert message={worker.error} />}

              <div className="flex items-center gap-3">
                <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
                  <Eraser className="mr-1 h-4 w-4" /> Remove Background
                </Button>
                {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
              </div>
              {worker.running && <ProcessingOverlay label={worker.label || 'Removing background...'} progress={worker.progress} onCancel={worker.cancel} />}
            </div>
          )}
        </>
      ) : (
        /* Result with transparency toggle */
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Background Removed</h3>

          <div className="flex flex-wrap gap-2 mb-3">
            {files.map((_, i) => (
              <button key={i} type="button" onClick={() => setPreviewIndex(i)}
                className={`rounded-lg border-2 px-3 py-1 text-sm ${previewIndex === i ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                {i + 1}. {files[i].name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={() => setShowOriginal(!showOriginal)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-brand-300 transition-colors">
              {showOriginal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showOriginal ? 'Hide Original' : 'Show Original'}
            </button>
          </div>

          <div className="flex justify-center gap-6">
            {result[previewIndex] && (
              <>
                <div className="text-center">
                  <p className="mb-1 text-xs font-medium text-slate-500">Result</p>
                  <div className="checkerboard rounded-xl border border-slate-200 p-1 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result[previewIndex].url} alt="Background removed" className="max-h-[300px] rounded-lg" />
                  </div>
                </div>
                {showOriginal && files[previewIndex] && (
                  <div className="text-center">
                    <p className="mb-1 text-xs font-medium text-slate-500">Original</p>
                    <div className="rounded-xl border border-slate-200 p-1 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(files[previewIndex])} alt="Original" className="max-h-[300px] rounded-lg" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="text-xs text-slate-400">
            <Eye className="mr-1 inline h-3 w-3" /> Click "Show Original" to compare before/after
          </p>

          <div className="flex items-center gap-3">
            <Button onClick={() => { setResult(null); setShowOriginal(false) }}>Back</Button>
            <Button variant="outline" onClick={reset}>Start Over</Button>
          </div>

          <ResultPanel items={result} onReset={reset} />
        </div>
      )}
    </Card>
  )
}

function CheckerboardPreview({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null)

  useState(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setSrc(url)
    }
  })

  return (
    <div className="relative max-h-[300px] overflow-hidden rounded-xl border border-slate-200">
      <div className="checkerboard">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Preview" className="max-h-[300px] w-auto object-contain" />
        )}
      </div>
      <div className="absolute bottom-1 right-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
        Preview
      </div>
    </div>
  )
}
