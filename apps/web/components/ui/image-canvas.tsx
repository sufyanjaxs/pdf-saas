'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

export interface ImageCanvasProps {
  file: File
  className?: string
  children?: React.ReactNode
  onNaturalSize?: (w: number, h: number) => void
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
}

export function ImageCanvas({
  file,
  className = '',
  children,
  onNaturalSize,
  onPointerDown: onPointerDownProp,
  onPointerMove: onPointerMoveProp,
  onPointerUp: onPointerUpProp,
}: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    setNatural({ w: 0, h: 0 })
    setZoom(1)
    setPan({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleLoad = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const w = img.naturalWidth
    const h = img.naturalHeight
    setNatural({ w, h })
    onNaturalSize?.(w, h)
  }, [onNaturalSize])

  const fitToContainer = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const rectOf = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect()
    return r ?? { left: 0, top: 0, width: 0, height: 0 }
  }, [])

  return (
    <div className={`relative flex flex-col ${className}`}>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 touch-none select-none"
        style={{ maxHeight: '60vh' }}
        onPointerDown={onPointerDownProp}
        onPointerMove={onPointerMoveProp}
        onPointerUp={onPointerUpProp}
        onPointerLeave={onPointerUpProp}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt="Preview"
            className="mx-auto block max-h-[60vh] w-auto select-none"
            draggable={false}
            onLoad={handleLoad}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center',
            }}
          />
        )}
        {children}
      </div>

      {/* Zoom controls */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={25}
          max={400}
          value={zoom * 100}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          className="flex-1 accent-brand-600"
          aria-label="Zoom level"
        />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={fitToContainer}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <span className="ml-1 min-w-[3rem] text-center text-xs text-slate-400 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Natural size info */}
      {natural.w > 0 && (
        <p className="mt-1 text-center text-xs text-slate-400">
          {natural.w} × {natural.h} px
        </p>
      )}
    </div>
  )
}

export function useImageLoader(file: File | null) {
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!file) { setSrc(null); return }
    const url = URL.createObjectURL(file)
    setSrc(url)
    setNatural({ w: 0, h: 0 })
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    imgRef.current = img
    setNatural({ w: img.naturalWidth, h: img.naturalHeight })
  }, [])

  return { src, natural, handleLoad, imgRef }
}
