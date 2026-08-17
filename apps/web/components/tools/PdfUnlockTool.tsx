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

export function PdfUnlockTool() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null)
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('unlock', { bytes: new Uint8Array(bytes), password: password || undefined })
    setResult([
      {
        name: defaultOutputName(file.name, 'unlocked', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, password, worker])

  const reset = useCallback(() => {
    setFile(null)
    setPassword('')
    setResult(null)
  }, [])

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <label className="block text-sm text-slate-700">
            Password (only needed if the PDF is protected)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password to open the PDF"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>

          {worker.error && <ErrorAlert message={worker.error} />}

          <Button size="lg" loading={worker.running} onClick={() => void run()}>
            Unlock PDF
          </Button>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Unlocking PDF…'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
