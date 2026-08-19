'use client'

import { useCallback, useRef, useState } from 'react'

export interface BeforeAfterSliderProps {
  beforeUrl: string
  afterUrl: string
  beforeLabel?: string
  afterLabel?: string
  beforeSize?: string
  afterSize?: string
  className?: string
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Original',
  afterLabel = 'Result',
  beforeSize,
  afterSize,
  className = '',
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(50)
  const dragging = useRef(false)

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    setPosition((x / rect.width) * 100)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updatePosition(e.clientX)
  }, [updatePosition])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    updatePosition(e.clientX)
  }, [updatePosition])

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-slate-200 select-none touch-none cursor-col-resize"
        style={{ aspectRatio: '16/10' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* After (full width) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt={afterLabel} className="absolute inset-0 h-full w-full object-contain" draggable={false} />

        {/* Before (clipped) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt={beforeLabel} className="absolute inset-0 h-full object-contain" draggable={false}
            style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }} />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 z-10 h-full w-0.5 bg-white shadow-lg"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          {/* Handle */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand-500 shadow-lg">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
              <path d="M5 3L2 8L5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 3L14 8L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute left-3 top-3 z-20 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
          {beforeLabel}
          {beforeSize && <span className="ml-1 text-white/70">{beforeSize}</span>}
        </div>
        <div className="absolute right-3 top-3 z-20 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
          {afterLabel}
          {afterSize && <span className="ml-1 text-white/70">{afterSize}</span>}
        </div>
      </div>
    </div>
  )
}
