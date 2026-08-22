'use client'

import { useCallback, useState } from 'react'
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
import { Unlock, Eye, EyeOff } from 'lucide-react'

export function PdfUnlockTool() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null); releaseResultUrls()
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
    setResult(null); releaseResultUrls()
  }, [])

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      preview={
        <div className="flex h-full flex-col items-center justify-center p-8">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg">
            <Unlock className="h-12 w-12 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Unlock PDF</h3>
          <p className="mt-1 max-w-xs text-center text-sm text-slate-500">
            Remove password protection from your PDF file
          </p>
          <p className="mt-3 max-w-xs text-center text-xs text-slate-400">
            Leave blank if the PDF opens without a password
          </p>
        </div>
      }
      controls={
        <>
          <FileList files={[file]} onRemove={reset} />

          <ControlSection title="Password (optional)">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter current password (if any)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">If the PDF has no password, just click Unlock</p>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} onClick={() => void run()}>
              <Unlock className="mr-1 h-4 w-4" /> Unlock PDF
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Unlocking PDFâ€¦'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
