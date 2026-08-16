'use client'

import { CheckCircle2, Download, RotateCcw, FileDown } from 'lucide-react'
import { formatBytes } from '@pdf-saas/file-utils'
import { Button } from '@/components/ui/button'

export interface ResultItem {
  name: string
  url: string
  size: number
  detail?: string
}

export interface ResultPanelProps {
  items: ResultItem[]
  summary?: string
  onReset: () => void
}

export function ResultPanel({ items, summary, onReset }: ResultPanelProps) {
  if (items.length === 0) return null
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
      <div className="mb-4 flex items-center gap-2 text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-semibold">Done!</span>
        {summary && <span className="text-sm text-emerald-600">{summary}</span>}
      </div>

      <ul className="mb-5 space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item.name}-${i}`}
            className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3"
          >
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
          </li>
        ))}
      </ul>

      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="h-4 w-4" />
        Start over
      </Button>
    </div>
  )
}
