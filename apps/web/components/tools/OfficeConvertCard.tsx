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
import { formatBytes } from '@pdf-saas/file-utils'

export interface OfficeConvertCardProps {
  accept: string
  hint?: string
  actionLabel: string
  outputName: (inputName: string) => string
  convert: (bytes: ArrayBuffer, onProgress: (pct: number, label?: string) => void) => Promise<Blob>
}

/**
 * Shared shell for the one-file-in / one-file-out office conversions.
 * Conversion is delegated to a lazy-loaded, browser-only helper.
 */
export function OfficeConvertCard({
  accept,
  hint,
  actionLabel,
  outputName,
  convert,
}: OfficeConvertCardProps) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultItem[] | null>(null)

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null)
    setError(null)
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    setResult(null)
    setError(null)
    setProgress(0)
    setLabel('Starting…')
    try {
      const bytes = await file.arrayBuffer()
      const blob = await convert(bytes, (pct, l) => {
        setProgress(pct)
        if (l) setLabel(l)
      })
      setResult([
        {
          name: outputName(file.name),
          url: URL.createObjectURL(blob),
          size: blob.size,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setProgress(null)
      setLabel('')
    }
  }, [file, convert, outputName])

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
    setError(null)
  }, [])

  const running = progress !== null

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept={accept} maxSizeMB={200} multiple={false} hint={hint} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          {error && <ErrorAlert message={error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={running} disabled={running} onClick={() => void run()}>
              {actionLabel}
            </Button>
          </div>
          <ProgressBar value={progress} label={label} />
          {running && <ProcessingOverlay label={label || 'Converting…'} progress={progress} />}

          {result && (
            <ResultPanel
              items={result}
              summary={`${result[0].name} · ${formatBytes(result[0].size)}`}
              onReset={reset}
            />
          )}
        </div>
      )}
    </Card>
  )
}
