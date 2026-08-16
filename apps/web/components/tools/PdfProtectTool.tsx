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

export function PdfProtectTool() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = usePdfWorker()

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null)
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    if (password.length < 4) {
      worker.resetError()
      setError('Password must be at least 4 characters.')
      return
    }
    if (password !== confirm) {
      worker.resetError()
      setError('Passwords do not match.')
      return
    }
    setError(null)
    const bytes = await file.arrayBuffer()
    const res = await worker.run('protect', { bytes: new Uint8Array(bytes), password })
    setResult([
      {
        name: defaultOutputName(file.name, 'protected', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, password, confirm, worker])

  const reset = useCallback(() => {
    setFile(null)
    setPassword('')
    setConfirm('')
    setResult(null)
    setError(null)
  }, [])

  const [error, setError] = useState<string | null>(null)

  return (
    <Card>
      {!file ? (
        <FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 4 characters"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Confirm password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>

          {error && <ErrorAlert message={error} />}
          {worker.error && <ErrorAlert message={worker.error} />}

          <Button size="lg" loading={worker.running} disabled={password.length < 4} onClick={() => void run()}>
            Protect PDF
          </Button>
          <ProgressBar value={worker.progress} label={worker.label} />

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
