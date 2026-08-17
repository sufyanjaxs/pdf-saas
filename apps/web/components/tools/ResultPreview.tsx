'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadPdfDocument } from '@/lib/pdfjs'

export interface ResultPreviewProps {
  url: string
  mime: string
  name: string
  className?: string
}

/**
 * Auto-detects file type from MIME and renders a live preview:
 * - PDFs: renders first page to canvas → JPEG data-URL
 * - Images: renders inline via <img>
 * - Other: no preview (returns null)
 */
export function ResultPreview({ url, mime, name, className }: ResultPreviewProps) {
  if (mime === 'application/pdf') {
    return <PdfPreview url={url} name={name} className={className} />
  }
  if (mime.startsWith('image/')) {
    return <ImagePreview url={url} name={name} className={className} />
  }
  return null
}

/* ------------------------------------------------------------------ */
/* PDF first-page preview (rendered via pdf.js canvas)                 */
/* ------------------------------------------------------------------ */

function PdfPreview({ url, name, className }: { url: string; name: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setSrc(null)
    setError(false)
    const ctrl = new AbortController()

    void (async () => {
      try {
        const resp = await fetch(url, { signal: ctrl.signal })
        const buf = await resp.arrayBuffer()
        if (!active) return
        const doc = await loadPdfDocument(buf)
        const page = await doc.getPage(1)
        const vp = page.getViewport({ scale: 0.5 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(vp.width)
        canvas.height = Math.floor(vp.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas unavailable')
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        if (active) setSrc(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        if (active) setError(true)
      }
    })()

    return () => {
      active = false
      ctrl.abort()
    }
  }, [url])

  if (error) return null
  if (!src) {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-slate-100 ${className ?? 'h-48'}`}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Preview of ${name}`}
      className={`rounded-lg border border-slate-200 object-contain ${className ?? ''}`}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Image preview (direct blob/object URL)                              */
/* ------------------------------------------------------------------ */

function ImagePreview({ url, name, className }: { url: string; name: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (error) return null

  return (
    <>
      {!loaded && (
        <div className={`flex items-center justify-center rounded-lg bg-slate-100 ${className ?? 'h-48'}`}>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Preview of ${name}`}
        className={`rounded-lg border border-slate-200 object-contain ${loaded ? '' : 'hidden'} ${className ?? ''}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  )
}
