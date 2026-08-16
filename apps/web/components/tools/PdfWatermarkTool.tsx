'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl } from '@/lib/client-utils'

export function PdfWatermarkTool() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(0.25)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null)
  }, [])

  const run = useCallback(async () => {
    if (!file || !text.trim()) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('watermark', {
      bytes: new Uint8Array(bytes),
      text: text.trim(),
      opacity,
      size: 48,
    })
    setResult([
      {
        name: defaultOutputName(file.name, 'watermarked', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, text, opacity, worker])

  const reset = useCallback(() => {
    setFile(null)
    setText('CONFIDENTIAL')
    setOpacity(0.25)
    setResult(null)
  }, [])

  return (
    <Card>
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Watermark text
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. CONFIDENTIAL"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Opacity — {(opacity * 100).toFixed(0)}%
              <input
                type="range"
                min={5}
                max={60}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="mt-3 w-full accent-brand-600"
              />
            </label>
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <Button size="lg" loading={worker.running} disabled={!text.trim()} onClick={() => void run()}>
            Add Watermark
          </Button>
          <ProgressBar value={worker.progress} label={worker.label} />

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
