'use client'

import { useState } from 'react'
import { CheckCircle2, Download, RotateCcw, FileDown, Eye, EyeOff } from 'lucide-react'
import { formatBytes } from '@pdf-saas/file-utils'
import { Button } from '@/components/ui/button'
import { ResultPreview } from './ResultPreview'

export interface ResultItem {
  name: string
  url: string
  size: number
  detail?: string
  mime?: string
}

export interface ResultPanelProps {
  items: ResultItem[]
  summary?: string
  onReset: () => void
}

function detectMime(name: string, fallback?: string): string {
  if (fallback) return fallback
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    doc: 'application/msword',
  }
  return map[ext] ?? 'application/octet-stream'
}

export function ResultPanel({ items, summary, onReset }: ResultPanelProps) {
  const [showPreviews, setShowPreviews] = useState(true)
  if (items.length === 0) return null

  const totalSize = items.reduce((s, r) => s + r.size, 0)
  const hasPreviewable = items.some((item) => {
    const mime = detectMime(item.name, item.mime)
    return mime === 'application/pdf' || mime.startsWith('image/')
  })

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-semibold">Done!</span>
          {summary && <span className="text-sm text-emerald-600">{summary}</span>}
        </div>
        {hasPreviewable && (
          <button
            type="button"
            onClick={() => setShowPreviews(!showPreviews)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-emerald-50"
          >
            {showPreviews ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreviews ? 'Hide preview' : 'Show preview'}
          </button>
        )}
      </div>

      {/* Stats bar */}
      {items.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="rounded-lg bg-white px-2.5 py-1 font-medium">{items.length} file{items.length === 1 ? '' : 's'}</span>
          <span className="rounded-lg bg-white px-2.5 py-1">{formatBytes(totalSize)} total</span>
        </div>
      )}

      <ul className="mb-5 space-y-3">
        {items.map((item, i) => {
          const mime = detectMime(item.name, item.mime)
          const isPreviewable = mime === 'application/pdf' || mime.startsWith('image/')
          return (
            <li
              key={`${item.name}-${i}`}
              className="rounded-xl border border-emerald-100 bg-white overflow-hidden"
            >
              {/* Preview area */}
              {showPreviews && isPreviewable && (
                <div className="flex justify-center border-b border-emerald-50 bg-slate-50/50 p-3">
                  <ResultPreview
                    url={item.url}
                    mime={mime}
                    name={item.name}
                    className="max-h-64 w-auto max-w-full"
                  />
                </div>
              )}

              {/* Info + download row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <FileDown className="h-5 w-5 shrink-0 text-brand-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(item.size)}
                    {item.detail ? ` · ${item.detail}` : ''}
                  </p>
                </div>
                <a
                  href={item.url}
                  download={item.name}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            </li>
          )
        })}
      </ul>

      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="h-4 w-4" />
        Start over
      </Button>
    </div>
  )
}
