'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZoomControls, PageNavigation } from './zoom-controls'
import { Button } from './button'
import { Loader2 } from 'lucide-react'

export interface PdfPageThumb {
  pageNum: number
  dataUrl: string
}

export function PdfThumbnailStrip({
  pages,
  currentPage,
  onSelectPage,
  selectedPages,
  onTogglePage,
  selectionMode,
}: {
  pages: PdfPageThumb[]
  currentPage: number
  onSelectPage: (page: number) => void
  selectedPages?: Set<number>
  onTogglePage?: (page: number) => void
  selectionMode?: boolean
}) {
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-page="${currentPage}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [currentPage])

  return (
    <div ref={stripRef} className="pdf-thumb-strip">
      {pages.map((p) => {
        const isSelected = selectedPages?.has(p.pageNum)
        const isCurrent = p.pageNum === currentPage
        return (
          <button
            key={p.pageNum}
            data-page={p.pageNum}
            type="button"
            onClick={() => selectionMode && onTogglePage ? onTogglePage(p.pageNum) : onSelectPage(p.pageNum)}
            className={`flex-shrink-0 rounded-lg border-2 p-1 transition-all ${
              selectionMode && isSelected
                ? 'border-brand-600 bg-brand-50'
                : isCurrent
                  ? 'border-brand-400 shadow-md'
                  : 'border-transparent hover:border-slate-300'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.dataUrl}
              alt={`Page ${p.pageNum}`}
              className="h-20 w-auto rounded bg-white shadow-sm"
            />
            <p className="mt-1 text-center text-[10px] font-medium text-slate-500">
              {p.pageNum}
              {selectionMode && isSelected && <span className="text-brand-600"> ✓</span>}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export function PdfPreviewPanel({
  pages,
  currentPage,
  onSelectPage,
  selectedPages,
  onTogglePage,
  selectionMode,
  zoom,
  onZoomChange,
  children,
}: {
  pages: PdfPageThumb[]
  currentPage: number
  onSelectPage: (p: number) => void
  selectedPages?: Set<number>
  onTogglePage?: (p: number) => void
  selectionMode?: boolean
  zoom: number
  onZoomChange: (z: number) => void
  children?: ReactNode
}) {
  const [rotation, setRotation] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const zoomIn = useCallback(() => onZoomChange(Math.min(3, zoom + 0.25)), [zoom, onZoomChange])
  const zoomOut = useCallback(() => onZoomChange(Math.max(0.25, zoom - 0.25)), [zoom, onZoomChange])
  const fitWidth = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const page = pages.find((p) => p.pageNum === currentPage)
    if (!page) return
    const img = new Image()
    img.onload = () => {
      const containerWidth = container.clientWidth - 32
      onZoomChange(containerWidth / img.naturalWidth)
    }
    img.src = page.dataUrl
  }, [pages, currentPage, onZoomChange])
  const fitPage = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const page = pages.find((p) => p.pageNum === currentPage)
    if (!page) return
    const img = new Image()
    img.onload = () => {
      const containerWidth = container.clientWidth - 32
      const containerHeight = container.clientHeight - 32
      const scaleW = containerWidth / img.naturalWidth
      const scaleH = containerHeight / img.naturalHeight
      onZoomChange(Math.min(scaleW, scaleH))
    }
    img.src = page.dataUrl
  }, [pages, currentPage, onZoomChange])

  const currentPageData = pages.find((p) => p.pageNum === currentPage)

  return (
    <div className="flex h-full flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <PageNavigation
          current={currentPage}
          total={pages.length}
          onPrev={() => onSelectPage(Math.max(1, currentPage - 1))}
          onNext={() => onSelectPage(Math.min(pages.length, currentPage + 1))}
          onFirst={() => onSelectPage(1)}
          onLast={() => onSelectPage(pages.length)}
        />
        <ZoomControls
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitWidth={fitWidth}
          onFitPage={fitPage}
        />
      </div>

      {/* Main preview */}
      <div ref={containerRef} className="relative flex-1 overflow-auto p-4">
        {currentPageData ? (
          <div className="mx-auto" style={{ width: 'fit-content', transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: 'top center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPageData.dataUrl}
              alt={`Page ${currentPage}`}
              className="max-w-full rounded bg-white shadow-lg"
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        )}
        {children}
      </div>

      {/* Bottom thumbnail strip */}
      <div className="border-t border-slate-200 bg-white px-3">
        <PdfThumbnailStrip
          pages={pages}
          currentPage={currentPage}
          onSelectPage={onSelectPage}
          selectedPages={selectedPages}
          onTogglePage={onTogglePage}
          selectionMode={selectionMode}
        />
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'
