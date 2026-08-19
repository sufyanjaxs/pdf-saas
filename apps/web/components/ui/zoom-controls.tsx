'use client'

import { ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight, RotateCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onFitPage,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitWidth: () => void
  onFitPage: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={onZoomOut} title="Zoom out">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="min-w-[3rem] text-center text-xs font-medium text-slate-600">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="sm" onClick={onZoomIn} title="Zoom in">
        <ZoomIn className="h-4 w-4" />
      </Button>
      <div className="mx-1 h-4 w-px bg-slate-200" />
      <Button variant="ghost" size="sm" onClick={onFitWidth} title="Fit width">
        <Maximize className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onFitPage} title="Fit page">
        <Maximize className="h-4 w-4 rotate-90" />
      </Button>
    </div>
  )
}

export function PageNavigation({
  current,
  total,
  onPrev,
  onNext,
  onFirst,
  onLast,
}: {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  onFirst: () => void
  onLast: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={onFirst} disabled={current <= 1}>
        <ChevronLeft className="h-4 w-4" />
        <ChevronLeft className="-ml-3 h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={current <= 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[5rem] text-center text-xs font-medium text-slate-600">
        {current} / {total}
      </span>
      <Button variant="ghost" size="sm" onClick={onNext} disabled={current >= total}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onLast} disabled={current >= total}>
        <ChevronRight className="h-4 w-4" />
        <ChevronRight className="-ml-3 h-4 w-4" />
      </Button>
    </div>
  )
}

export function RotateControls({
  onRotateLeft,
  onRotateRight,
}: {
  onRotateLeft: () => void
  onRotateRight: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={onRotateLeft} title="Rotate left 90°">
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onRotateRight} title="Rotate right 90°">
        <RotateCw className="h-4 w-4" />
      </Button>
    </div>
  )
}
