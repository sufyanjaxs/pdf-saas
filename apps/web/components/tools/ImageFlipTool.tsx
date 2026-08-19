'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { FlipHorizontal, FlipVertical } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

export function ImageFlipTool() {
  const [files, setFiles] = useState<File[]>([])
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const onFiles = useCallback((f: File[]) => { setFiles(f); setResult(null) }, [])

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('flip', { files: payloads, opts: { direction } })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}×${r.height}px | Flipped ${direction}`,
    }))
    setResult(items)
  }, [files, direction, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); setDirection('horizontal') }, [])

  if (files.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="flex h-full flex-col items-center justify-center p-4">
          <div className="overflow-hidden rounded-lg" style={{ transform: direction === 'horizontal' ? 'scaleX(-1)' : 'scaleY(-1)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={URL.createObjectURL(files[0])}
              alt="Preview"
              className="max-h-[50vh] max-w-full rounded bg-white shadow-sm"
              style={{ transform: 'none' }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-500">Preview shows the flipped result</p>
        </div>
      }
      controls={
        <>
          <ControlSection title="Flip Direction">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('horizontal')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 transition-all ${
                  direction === 'horizontal' ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300'
                }`}
              >
                <FlipHorizontal className={`h-6 w-6 ${direction === 'horizontal' ? 'text-brand-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${direction === 'horizontal' ? 'text-brand-700' : 'text-slate-700'}`}>Horizontal</p>
                  <p className="text-[10px] text-slate-400">Left ↔ Right</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDirection('vertical')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 transition-all ${
                  direction === 'vertical' ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300'
                }`}
              >
                <FlipVertical className={`h-6 w-6 ${direction === 'vertical' ? 'text-brand-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${direction === 'vertical' ? 'text-brand-700' : 'text-slate-700'}`}>Vertical</p>
                  <p className="text-[10px] text-slate-400">Top ↔ Bottom</p>
                </div>
              </button>
            </div>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              Flip Image
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Flipping...'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
