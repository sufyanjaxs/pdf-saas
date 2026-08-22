'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileUploader } from './FileUploader'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { CropOverlay, type CropRect } from '@/components/ui/crop-overlay'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { RotateCcw, Grid3x3 } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

interface CropPreset {
  id: string
  label: string
  sublabel: string
  ratio?: number
}

const PRESETS: CropPreset[] = [
  { id: 'free', label: 'Free', sublabel: 'Any size' },
  { id: 'square', label: '1:1', sublabel: 'Square', ratio: 1 },
  { id: 'portrait-4-5', label: '4:5', sublabel: 'Portrait' },
  { id: 'portrait-3-4', label: '3:4', sublabel: 'Portrait' },
  { id: 'landscape-16-9', label: '16:9', sublabel: 'Landscape' },
  { id: 'landscape-3-2', label: '3:2', sublabel: 'Landscape', ratio: 3 / 2 },
  { id: 'portrait-9-16', label: '9:16', sublabel: 'Story' },
  { id: 'passport', label: 'Passport', sublabel: '1:1', ratio: 1 },
  { id: 'custom', label: 'Custom', sublabel: 'W:H' },
]

function getPresetRatio(id: string): number | undefined {
  const map: Record<string, number> = {
    'square': 1,
    'portrait-4-5': 4 / 5,
    'portrait-3-4': 3 / 4,
    'landscape-16-9': 16 / 9,
    'landscape-3-2': 3 / 2,
    'portrait-9-16': 9 / 16,
    'passport': 1,
  }
  return map[id]
}

export function ImageCropperTool() {
  const [file, setFile] = useState<File | null>(null)
  const [preset, setPreset] = useState('free')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [sel, setSel] = useState<CropRect | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [displayScale, setDisplayScale] = useState(1)
  const [trimMode, setTrimMode] = useState(false)
  const [trimValues, setTrimValues] = useState({ top: 0, right: 0, bottom: 0, left: 0 })
  const worker = useImageWorker()

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null); releaseResultUrls()
    setPreset('free')
    setSel(null)
    setTrimMode(false)
    setTrimValues({ top: 0, right: 0, bottom: 0, left: 0 })
  }, [])

  let aspectRatio: number | undefined
  if (preset === 'custom') {
    const cw = parseFloat(customW)
    const ch = parseFloat(customH)
    if (cw > 0 && ch > 0) aspectRatio = cw / ch
  } else {
    aspectRatio = getPresetRatio(preset)
  }

  // Compute display scale (natural â†’ display coordinates)
  const computeScale = useCallback((containerW: number, containerH: number) => {
    if (natural.w === 0 || natural.h === 0) return 1
    return Math.min(containerW / natural.w, containerH / natural.h, 1)
  }, [natural])

  // Handle natural size from the image
  const handleNaturalSize = useCallback((w: number, h: number) => {
    setNatural({ w, h })
    // Initialize crop to full image
    if (!sel) {
      setSel({ x: 0, y: 0, w: w, h: h })
    }
  }, [sel])

  // Sync selection to exact dimension inputs
  const syncToInputs = useCallback((crop: CropRect) => {
    if (displayScale === 0) return
    const natW = Math.round(crop.w / displayScale)
    const natH = Math.round(crop.h / displayScale)
    setCustomW(String(natW))
    setCustomH(String(natH))
  }, [displayScale])

  // Sync exact inputs to crop selection
  const syncFromInputs = useCallback(() => {
    const w = parseInt(customW, 10)
    const h = parseInt(customH, 10)
    if (w > 0 && h > 0 && displayScale > 0) {
      setSel((prev) => {
        if (!prev) return { x: 0, y: 0, w: w * displayScale, h: h * displayScale }
        return { ...prev, w: w * displayScale, h: h * displayScale }
      })
    }
  }, [customW, customH, displayScale])

  // Sync trim values to crop selection
  const syncFromTrim = useCallback(() => {
    if (natural.w === 0 || natural.h === 0 || displayScale === 0) return
    const x = trimValues.left * displayScale
    const y = trimValues.top * displayScale
    const w = (natural.w - trimValues.left - trimValues.right) * displayScale
    const h = (natural.h - trimValues.top - trimValues.bottom) * displayScale
    if (w > 10 && h > 10) {
      setSel({ x, y, w, h })
    }
  }, [trimValues, natural, displayScale])

  useEffect(() => { syncFromInputs() }, [customW, customH]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { syncFromTrim() }, [trimValues]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update inputs when selection changes via drag
  const handleSelectionChange = useCallback((newSel: CropRect) => {
    setSel(newSel)
    syncToInputs(newSel)
    // Update trim values
    if (displayScale > 0 && natural.w > 0 && natural.h > 0) {
      setTrimValues({
        top: Math.round(newSel.y / displayScale),
        left: Math.round(newSel.x / displayScale),
        right: Math.round((natural.w - (newSel.x + newSel.w) / displayScale)),
        bottom: Math.round((natural.h - (newSel.y + newSel.h) / displayScale)),
      })
    }
  }, [syncToInputs, displayScale, natural])

  const run = useCallback(async (crop: CropRect) => {
    if (!file || displayScale === 0) return
    setResult(null); releaseResultUrls()
    const payload = await fileToImagePayload(file)
    const scaledCrop = {
      x: Math.round(crop.x / displayScale),
      y: Math.round(crop.y / displayScale),
      width: Math.round(crop.w / displayScale),
      height: Math.round(crop.h / displayScale),
    }
    const [res] = await worker.run('crop', { files: [payload], opts: scaledCrop })
    const dot = file.name.lastIndexOf('.')
    const base = dot === -1 ? file.name : file.name.slice(0, dot)
    setResult([{ name: `${base}-crop.jpg`, url: resultBlobUrl(res.mime, res.bytes), size: res.size, detail: `${res.width}Ã—${res.height}` }])
  }, [file, worker, displayScale])

  const reset = useCallback(() => {
    setFile(null); setResult(null); releaseResultUrls(); setPreset('free'); setSel(null)
    setTrimMode(false); setTrimValues({ top: 0, right: 0, bottom: 0, left: 0 })
  }, [])

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept={ACCEPT} maxSizeMB={50} multiple={false} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  const cropPixels = sel && displayScale > 0
    ? { w: Math.round(sel.w / displayScale), h: Math.round(sel.h / displayScale) }
    : null

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="flex h-full flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  showGrid ? 'bg-brand-100 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Grid3x3 className="inline h-3.5 w-3.5 mr-1" />
                Grid
              </button>
            </div>
            {natural.w > 0 && (
              <span className="text-xs text-slate-400">{natural.w}Ã—{natural.h} px</span>
            )}
          </div>

          {/* Crop canvas */}
          <CropOverlay
            naturalWidth={natural.w}
            naturalHeight={natural.h}
            selection={sel}
            onSelectionChange={handleSelectionChange}
            aspectRatio={aspectRatio}
            showGrid={showGrid}
            className="flex-1 bg-slate-100"
            onInteraction={() => setTrimMode(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={URL.createObjectURL(file)}
              alt="Image to crop"
              className="mx-auto block max-h-full w-auto select-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                handleNaturalSize(img.naturalWidth, img.naturalHeight)
                const container = img.parentElement
                if (container) {
                  const r = container.getBoundingClientRect()
                  const imgRect = img.getBoundingClientRect()
                  const offsetX = (r.width - imgRect.width) / 2
                  const offsetY = (r.height - imgRect.height) / 2
                  const scale = Math.min(imgRect.width / img.naturalWidth, imgRect.height / img.naturalHeight, 1)
                  setDisplayScale(scale)
                  setSel({ x: offsetX, y: offsetY, w: img.naturalWidth * scale, h: img.naturalHeight * scale })
                }
              }}
            />

            {!sel && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center">
                <span className="rounded-full bg-black/60 px-4 py-2 text-sm text-white">Drag on the image to select the area to keep</span>
              </div>
            )}
          </CropOverlay>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                onClick={() => sel && run(sel)}
                disabled={worker.running || !sel || sel.w < 5}
                loading={worker.running}
              >
                Crop Image
              </Button>
              {sel && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setSel({ x: 0, y: 0, w: natural.w * displayScale, h: natural.h * displayScale })
                  setTrimValues({ top: 0, right: 0, bottom: 0, left: 0 })
                }}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
                </Button>
              )}
            </div>
            {cropPixels && (
              <div className="text-xs text-slate-500">
                Crop: {cropPixels.w} Ã— {cropPixels.h} px
                {natural.w > 0 && <span className="ml-2 text-slate-300">| Original: {natural.w}Ã—{natural.h}</span>}
              </div>
            )}
          </div>
        </div>
      }
      controls={
        <>
          <ControlSection title="Aspect Ratio">
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPreset(p.id)
                    if (p.ratio) {
                      setCustomW(String(Math.round(natural.w || 1000)))
                      setCustomH(String(Math.round((natural.h || 1000) / p.ratio)))
                    }
                  }}
                  className={`rounded-xl border-2 px-2 py-2 text-center transition-all ${
                    preset === p.id
                      ? 'border-brand-600 bg-brand-50 shadow-sm'
                      : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`block text-xs font-medium ${preset === p.id ? 'text-brand-700' : 'text-slate-700'}`}>
                    {p.label}
                  </span>
                  <span className="block text-[10px] text-slate-400">{p.sublabel}</span>
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="mt-3 flex items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">W</label>
                  <input
                    type="number" min={1} max={10000} value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                  />
                </div>
                <span className="mb-1.5 text-slate-400">:</span>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">H</label>
                  <input
                    type="number" min={1} max={10000} value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}
          </ControlSection>

          <ControlSection title="Exact Dimensions" collapsed>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">X</label>
                <input
                  type="number" min={0} max={natural.w}
                  value={sel ? Math.round(sel.x / displayScale) : 0}
                  onChange={(e) => {
                    const x = parseInt(e.target.value, 10) || 0
                    setSel((prev) => prev ? { ...prev, x: x * displayScale } : prev)
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Y</label>
                <input
                  type="number" min={0} max={natural.h}
                  value={sel ? Math.round(sel.y / displayScale) : 0}
                  onChange={(e) => {
                    const y = parseInt(e.target.value, 10) || 0
                    setSel((prev) => prev ? { ...prev, y: y * displayScale } : prev)
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Width</label>
                <input
                  type="number" min={1} max={natural.w} value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Height</label>
                <input
                  type="number" min={1} max={natural.h} value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </ControlSection>

          <ControlSection title="Crop from Sides" collapsed>
            <p className="mb-3 text-xs text-slate-400">Trim equal or custom amounts from each edge</p>
            <div className="grid grid-cols-2 gap-3">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                <div key={side}>
                  <label className="mb-1 block text-xs font-medium text-slate-500 capitalize">{side}</label>
                  <input
                    type="number" min={0} max={side === 'top' || side === 'bottom' ? natural.h : natural.w}
                    value={trimValues[side]}
                    onChange={(e) => setTrimValues((prev) => ({ ...prev, [side]: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {cropPixels ? `Result: ${cropPixels.w} Ã— ${cropPixels.h} px` : 'Drag crop box or enter values above'}
            </p>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}
          {worker.running && <ProcessingOverlay label={worker.label || 'Cropping...'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
