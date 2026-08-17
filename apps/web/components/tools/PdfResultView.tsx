'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw, FileText } from 'lucide-react'
import { formatBytes } from '@pdf-saas/file-utils'
import { loadPdfDocument } from '@/lib/pdfjs'

export interface PdfResultViewProps {
  name: string
  /** Object URL or blob of the produced PDF */
  file: File | Blob | string
  size: number
  pageCount?: number
  detail?: string
  onReset: () => void
}

/**
 * Result card that lets users *see* what was produced before downloading.
 * Renders a preview of the first page of the output PDF, plus a manual
 * Download button (processing always finishes before this renders; downloads
 * are never triggered automatically).
 */
export function PdfResultView({ name, file, size, pageCount = 1, detail, onReset }: PdfResultViewProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)

  const blobUrl = typeof file === 'string' ? file : URL.createObjectURL(file)

  useEffect(() => {
    let active = true
    setPreview(null)
    setPreviewError(false)
    const blob = typeof file === 'string' ? null : file
    if (!blob) return
    void (async () => {
      try {
        const buf = await blob.arrayBuffer()
        const doc = await loadPdfDocument(buf)
        const page = await doc.getPage(1)
        const vp = page.getViewport({ scale: 0.5 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(vp.width)
        canvas.height = Math.floor(vp.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas unavailable')
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        if (active) setPreview(dataUrl)
      } catch {
        if (active) setPreviewError(true)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  const download = useCallback(() => {
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = name
    a.click()
  }, [blobUrl, name])

  const reset = useCallback(() => {
    if (typeof file !== 'string') URL.revokeObjectURL(blobUrl)
    onReset()
  }, [blobUrl, file, onReset])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <FileText className="h-5 w-5 text-brand-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{name}</p>
          <p className="text-xs text-slate-500">
            {formatBytes(size)}
            {pageCount !== 1 && ` · ${pageCount} page${pageCount === 1 ? '' : 's'}`}
            {detail ? ` · ${detail}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      </div>

      {preview ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`First page of ${name}`} className="mx-auto rounded shadow" />
        </div>
      ) : previewError ? (
        <p className="text-xs text-slate-400">Preview unavailable</p>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
      >
        <RefreshCw className="h-4 w-4" />
        Start over
      </button>
    </div>
  )
}
