'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'lm' | 'rm'

export interface CropOverlayProps {
  /** Natural image dimensions */
  naturalWidth: number
  naturalHeight: number
  /** Current crop selection in display coordinates */
  selection: CropRect | null
  onSelectionChange: (sel: CropRect) => void
  /** Aspect ratio lock (width/height). undefined = free */
  aspectRatio?: number
  /** Show rule-of-thirds grid */
  showGrid?: boolean
  /** Minimum crop size in display pixels */
  minSize?: number
  /** Children to render inside the container (e.g. the image) */
  children: React.ReactNode
  /** Additional class for the container */
  className?: string
  /** Disable interaction */
  disabled?: boolean
  /** Called when user starts/resizes/moves the crop */
  onInteraction?: () => void
}

const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v))

export function CropOverlay({
  naturalWidth,
  naturalHeight,
  selection,
  onSelectionChange,
  aspectRatio,
  showGrid = true,
  minSize = 20,
  children,
  className = '',
  disabled = false,
  onInteraction,
}: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragMode = useRef<'create' | 'move' | Handle>('create')
  const startPos = useRef({ x: 0, y: 0, origSel: null as CropRect | null })

  const rectOf = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect()
    return r ?? { left: 0, top: 0, width: 0, height: 0 }
  }, [])

  const applyAspect = useCallback((s: CropRect, rectW: number, rectH: number): CropRect => {
    if (!aspectRatio) return s
    let { x, y, w, h } = s
    const dm = dragMode.current
    if (dm === 'create' || dm === 'tm' || dm === 'bm') {
      h = w / aspectRatio
    } else {
      w = h * aspectRatio
    }
    if (x + w > rectW) { w = rectW - x; h = w / aspectRatio }
    if (y + h > rectH) { h = rectH - y; w = h * aspectRatio }
    if (x < 0) { w += x; x = 0; h = w / aspectRatio }
    if (y < 0) { h += y; y = 0; w = h * aspectRatio }
    return { x, y, w: Math.max(minSize, w), h: Math.max(minSize, h) }
  }, [aspectRatio, minSize])

  const startDrag = useCallback((e: React.PointerEvent, mode: typeof dragMode.current) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
    dragMode.current = mode
    const r = rectOf()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    startPos.current = { x, y, origSel: selection ? { ...selection } : null }
    if (mode === 'create') onSelectionChange({ x, y, w: 0, h: 0 })
    onInteraction?.()
  }, [disabled, rectOf, selection, onSelectionChange, onInteraction])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const r = rectOf()
    const cx = clamp(e.clientX - r.left, 0, r.width)
    const cy = clamp(e.clientY - r.top, 0, r.height)
    const dx = cx - startPos.current.x
    const dy = cy - startPos.current.y
    const os = startPos.current.origSel

    if (dragMode.current === 'create') {
      let w = Math.abs(cx - startPos.current.x)
      let h = aspectRatio ? w / aspectRatio : Math.abs(cy - startPos.current.y)
      if (!aspectRatio) h = Math.abs(cy - startPos.current.y)
      const x = Math.min(cx, startPos.current.x)
      const y = aspectRatio
        ? Math.min(startPos.current.y, startPos.current.y + (cy > startPos.current.y ? h : -h))
        : Math.min(cy, startPos.current.y)
      onSelectionChange(applyAspect({ x, y, w: Math.max(2, w), h: Math.max(2, h) }, r.width, r.height))
      return
    }

    if (!os) return

    if (dragMode.current === 'move') {
      onSelectionChange({
        ...os,
        x: clamp(os.x + dx, 0, r.width - os.w),
        y: clamp(os.y + dy, 0, r.height - os.h),
      })
      return
    }

    let { x: nx, y: ny, w: nw, h: nh } = os
    const dm = dragMode.current

    if (dm === 'br' || dm === 'rm' || dm === 'bm') {
      nw = Math.max(minSize, dm === 'bm' || dm === 'rm' ? nw : cx - os.x)
      nh = Math.max(minSize, dm === 'bm' || dm === 'rm' ? nh : cy - os.y)
      if (dm !== 'rm' && aspectRatio) nh = nw / aspectRatio
      if (dm !== 'bm' && aspectRatio) nw = nh * aspectRatio
    }
    if (dm === 'tl') {
      nw = Math.max(minSize, os.x + os.w - cx)
      nh = aspectRatio ? nw / aspectRatio : Math.max(minSize, os.y + os.h - cy)
      nx = os.x + os.w - nw
      ny = os.y + os.h - nh
    }
    if (dm === 'tr') {
      nw = Math.max(minSize, cx - os.x)
      nh = aspectRatio ? nw / aspectRatio : Math.max(minSize, os.y + os.h - cy)
      ny = os.y + os.h - nh
    }
    if (dm === 'bl') {
      nw = Math.max(minSize, os.x + os.w - cx)
      nh = aspectRatio ? nw / aspectRatio : Math.max(minSize, cy - os.y)
      nx = os.x + os.w - nw
    }
    if (dm === 'tm') {
      nh = Math.max(minSize, os.y + os.h - cy)
      nw = aspectRatio ? nh * aspectRatio : os.w
      ny = os.y + os.h - nh
    }
    if (dm === 'bm') {
      nh = Math.max(minSize, cy - os.y)
      nw = aspectRatio ? nh * aspectRatio : os.w
    }

    nx = clamp(nx, 0, r.width - nw)
    ny = clamp(ny, 0, r.height - nh)
    onSelectionChange({ x: nx, y: ny, w: nw, h: nh })
  }, [rectOf, aspectRatio, applyAspect, minSize, onSelectionChange])

  const endDrag = useCallback(() => {
    if (dragging.current) dragging.current = false
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    const r = rectOf()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    if (selection && x >= selection.x && x <= selection.x + selection.w && y >= selection.y && y <= selection.y + selection.h) {
      startDrag(e, 'move')
      return
    }
    startDrag(e, 'create')
  }, [disabled, rectOf, selection, startDrag])

  const handleCursor = useCallback((hx: number, hy: number) => {
    if (!selection) return 'crosshair'
    const cx = selection.x + selection.w / 2
    const cy = selection.y + selection.h / 2
    const dx = hx - cx
    const dy = hy - cy
    if (Math.abs(dx) > Math.abs(dy) * 2) return 'ew-resize'
    if (Math.abs(dy) > Math.abs(dx) * 2) return 'ns-resize'
    return dx > 0 === dy > 0 ? 'nwse-resize' : 'nesw-resize'
  }, [selection])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden touch-none select-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      style={{ cursor: selection && !disabled ? 'move' : 'crosshair' }}
    >
      {children}

      {selection && selection.w > 0 && selection.h > 0 && (
        <>
          {/* Darkened area outside selection */}
          <div
            className="pointer-events-none absolute inset-0 border-2 border-white"
            style={{
              clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${selection.x}px ${selection.y}px, ${selection.x}px ${selection.y + selection.h}px, ${selection.x + selection.w}px ${selection.y + selection.h}px, ${selection.x + selection.w}px ${selection.y}px, ${selection.x}px ${selection.y}px)`,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            }}
          />

          {/* Rule of thirds grid */}
          {showGrid && (
            <div
              className="pointer-events-none absolute border border-white/40"
              style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h }}
            >
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 h-px w-full bg-white/30" />
              <div className="absolute top-2/3 left-0 h-px w-full bg-white/30" />
            </div>
          )}

          {/* Corner and edge handles */}
          {(['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'lm', 'rm'] as const).map((h) => {
            const isCorner = h.length === 2
            const hx = h.includes('l') ? selection.x : h.includes('r') ? selection.x + selection.w : selection.x + selection.w / 2
            const hy = h.includes('t') ? selection.y : h.includes('b') ? selection.y + selection.h : selection.y + selection.h / 2
            return (
              <div
                key={h}
                className={`absolute z-10 ${isCorner ? 'crop-handle-corner' : (h === 'tm' || h === 'bm') ? 'crop-handle-edge h-2.5 w-10 -translate-x-1/2' : 'crop-handle-edge h-10 w-2.5 -translate-y-1/2'}`}
                style={{ left: hx, top: hy, cursor: handleCursor(hx, hy), transform: 'translate(-50%, -50%)' }}
                onPointerDown={(e) => startDrag(e, h)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
