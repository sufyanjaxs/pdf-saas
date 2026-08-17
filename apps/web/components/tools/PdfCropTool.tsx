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
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'

interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

export function PdfCropTool() {
  const [file, setFile] = useState<File | null>(null)
  const [margins, setMargins] = useState<Margins>({ top: 5, right: 5, bottom: 5, left: 5 })
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null)
  }, [])

  const setMargin = useCallback((key: keyof Margins, value: number) => {
    setMargins((prev) => ({ ...prev, [key]: Math.max(0, Math.min(49, value)) }))
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('crop', { bytes: new Uint8Array(bytes), margins })
    setResult([
      {
        name: defaultOutputName(file.name, 'cropped', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, margins, worker])

  const reset = useCallback(() => {
    setFile(null)
    setMargins({ top: 5, right: 5, bottom: 5, left: 5 })
    setResult(null)
  }, [])

  const fields: Array<{ key: keyof Margins; label: string }> = [
    { key: 'top', label: 'Top %' },
    { key: 'right', label: 'Right %' },
    { key: 'bottom', label: 'Bottom %' },
    { key: 'left', label: 'Left %' },
  ]

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {fields.map((f) => (
              <label key={f.key} className="block text-sm text-slate-700">
                {f.label}
                <input
                  type="number"
                  min={0}
                  max={49}
                  value={margins[f.key]}
                  onChange={(e) => setMargin(f.key, Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </label>
            ))}
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <Button size="lg" loading={worker.running} onClick={() => void run()}>
            Crop PDF
          </Button>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Cropping PDF…'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
