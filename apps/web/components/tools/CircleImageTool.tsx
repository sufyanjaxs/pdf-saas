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
import { Circle, Download } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'
const SIZES = [64, 128, 256, 400, 512, 800, 1024]

export function CircleImageTool() {
  const [files, setFiles] = useState<File[]>([])
  const [size, setSize] = useState(256)
  const [border, setBorder] = useState(4)
  const [borderColor, setBorderColor] = useState('#ffffff')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const [squareStep] = await worker.run('resize', {
      files: payloads, opts: { width: size + border * 2, height: size + border * 2, fit: 'cover' }
    })
    const res = await worker.run('circle', {
      files: [{ bytes: squareStep.bytes, mime: squareStep.mime, name: squareStep.name }],
      opts: { size, borderColor, borderWidth: border }
    })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}×${r.height}px | Circle`
    }))
    setResult(items)
  }, [files, size, border, borderColor, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null) }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={50} onFiles={(incoming) => setFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

          {/* Live circle preview */}
          <div className="flex justify-center">
            {files[0] && (
              <CirclePreview file={files[0]} size={size} border={border} borderColor={borderColor} />
            )}
          </div>

          {/* Size */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Output Size</h3>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => (
                <button key={s} type="button" onClick={() => setSize(s)}
                  className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                    size === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}>{s}px</button>
              ))}
            </div>
          </div>

          {/* Border */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Border Width</h3>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={20} value={border} onChange={(e) => setBorder(Number(e.target.value))} className="flex-1 accent-brand-600" />
              <span className="w-12 text-center text-sm font-bold text-slate-700">{border}px</span>
            </div>
            {border > 0 && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-slate-500">Border Color</label>
                <div className="flex gap-2">
                  {['#ffffff', '#000000', '#3b82f6', '#22c55e', '#ef4444', '#f59e0b'].map((c) => (
                    <button key={c} type="button" onClick={() => setBorderColor(c)}
                      className={`h-8 w-8 rounded-full border-2 transition-colors ${borderColor === c ? 'border-brand-600 scale-110' : 'border-slate-200 hover:scale-105'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Result preview */}
          {result && (
            <div className="flex justify-center gap-4">
              {result.map((item, i) => (
                <div key={i} className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="Circle result" className="rounded-full border border-slate-200 shadow-sm" style={{ width: Math.min(size, 200), height: Math.min(size, 200) }} />
                  <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              <Circle className="mr-1 h-4 w-4" /> Make Circle {files.length === 1 ? '' : `(${files.length})`}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Creating circle image...'} progress={worker.progress} onCancel={worker.cancel} />}
          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}

function CirclePreview({ file, size, border, borderColor }: { file: File; size: number; border: number; borderColor: string }) {
  const displaySize = Math.min(size, 200)
  const previewUrl = URL.createObjectURL(file)
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative rounded-full border-2 border-slate-200 overflow-hidden" style={{ width: displaySize, height: displaySize }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
        <div className="absolute inset-0 rounded-full border-2" style={{ borderColor, borderWidth: border }} />
      </div>
      <p className="text-xs text-slate-400">Preview at {displaySize}px</p>
    </div>
  )
}
