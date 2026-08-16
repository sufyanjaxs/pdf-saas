'use client'

import type { RenderedPage } from '@/lib/pdfjs'
import { Loader2 } from 'lucide-react'

export interface PageGridProps {
  pages: RenderedPage[]
  selected?: Set<number>
  onToggle?: (pageNumber: number) => void
  selectedAll?: boolean
  loading?: boolean
}

export function PageGrid({ pages, selected, onToggle, loading }: PageGridProps) {
  if (loading && pages.length === 0) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Rendering page thumbnails…
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {pages.map((page) => {
        const isSel = selected?.has(page.pageNumber) ?? false
        return (
          <button
            key={page.pageNumber}
            type="button"
            onClick={() => onToggle?.(page.pageNumber)}
            aria-pressed={isSel}
            className={`group relative overflow-hidden rounded-lg border-2 bg-white text-left transition-all ${
              isSel
                ? 'border-brand-600 ring-2 ring-brand-200'
                : 'border-slate-200 hover:border-brand-300'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.dataUrl}
              alt={`Page ${page.pageNumber}`}
              className="aspect-[3/4] w-full object-cover"
            />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {page.pageNumber}
            </span>
            <span
              className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                isSel ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-transparent'
              }`}
            >
              ✓
            </span>
          </button>
        )
      })}
    </div>
  )
}
