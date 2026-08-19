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
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'

const ACCEPT = 'image/jpeg,image/png,image/webp'

const BG_OPTIONS = [
  { id: 'transparent', name: 'Transparent', color: '' },
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'black', name: 'Black', color: '#000000' },
  { id: 'gray', name: 'Gray', color: '#95a5a6' },
  { id: 'blue', name: 'Blue', color: '#3498db' },
  { id: 'red', name: 'Red', color: '#e74c3c' },
  { id: 'green', name: 'Green', color: '#2ecc71' },
  { id: 'custom', name: 'Custom', color: '' },
]

export function CircleImageTool() {
  const [files, setFiles] = useState<File[]>([])
  const [bgOption, setBgOption] = useState('transparent')
  const [customBg, setCustomBg] = useState('#ffffff')
  const [borderWidth, setBorderWidth] = useState(0)
  const [borderColor, setBorderColor] = useState('#ffffff')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const bgColor = bgOption === 'custom' ? customBg : BG_OPTIONS.find((b) => b.id === bgOption)?.color ?? ''

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))

    const res = await worker.run('circle-crop', {
      files: payloads,
      opts: {
        bgColor: bgColor || undefined,
        borderWidth,
        borderColor,
      },
    })

    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name,
      url: resultBlobUrl(r.mime, r.bytes),
      size: r.size,
      detail: `${r.width}x${r.height} | PNG`,
    }))
    setResult(items)
  }, [files, bgColor, borderWidth, borderColor, worker])

  const reset = useCallback(() => {
    setFiles([])
    setResult(null)
  }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => setFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

          {/* Background */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Background</h3>
            <div className="flex flex-wrap gap-2">
              {BG_OPTIONS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBgOption(bg.id)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                    bgOption === bg.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-brand-300'
                  }`}
                >
                  {bg.id === 'transparent' ? (
                    <span className="h-4 w-4 rounded-full border-2 border-dashed border-slate-300 bg-white" />
                  ) : bg.id === 'custom' ? (
                    <input type="color" value={customBg} onChange={(e) => { setCustomBg(e.target.value); setBgOption('custom') }}
                      className="h-4 w-4 cursor-pointer border-0 p-0" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: bg.color }} />
                  )}
                  <span className="text-slate-700">{bg.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Border */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Border Width (px)</label>
              <input type="range" min={0} max={20} value={borderWidth} onChange={(e) => setBorderWidth(Number(e.target.value))} className="w-full accent-brand-600" />
              <span className="text-xs text-slate-400">{borderWidth}px</span>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Border Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border" />
                <span className="text-xs text-slate-400">{borderColor}</span>
              </div>
            </div>
          </div>

          {/* Preview hint */}
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Output is always transparent PNG. Circle crop centers on the image and takes the largest possible circle.
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              Create Circle Image{files.length > 1 ? 's' : ''}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Creating circle images...'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
