'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { fileToImagePayload, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { Globe, Printer } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

interface PhotoPreset { id: string; name: string; country: string; width: number; height: number; desc: string }

const PRESETS: PhotoPreset[] = [
  { id: 'us-passport', name: 'US Passport', country: 'USA', width: 600, height: 600, desc: '2Ã—2 in (51Ã—51mm)' },
  { id: 'us-visa', name: 'US Visa', country: 'USA', width: 600, height: 600, desc: '2Ã—2 in (51Ã—51mm)' },
  { id: 'uk-passport', name: 'UK Passport', country: 'UK', width: 420, height: 525, desc: '35Ã—45mm' },
  { id: 'eu-id', name: 'EU ID Card', country: 'EU', width: 420, height: 525, desc: '35Ã—45mm' },
  { id: 'canada-passport', name: 'Canada Passport', country: 'Canada', width: 420, height: 540, desc: '35Ã—45mm' },
  { id: 'australia-passport', name: 'Australia', country: 'Australia', width: 420, height: 525, desc: '35Ã—45mm' },
  { id: 'india-passport', name: 'India Passport', country: 'India', width: 600, height: 600, desc: '2Ã—2 in (51Ã—51mm)' },
  { id: 'china-passport', name: 'China Passport', country: 'China', width: 390, height: 567, desc: '33Ã—48mm' },
  { id: 'custom', name: 'Custom Size', country: '', width: 600, height: 600, desc: 'Your own size' },
]

const BG_COLORS = [
  { id: 'white', name: 'White', color: '#ffffff' },
  { id: 'light-blue', name: 'Light Blue', color: '#d4e6f1' },
  { id: 'blue', name: 'Blue', color: '#2980b9' },
  { id: 'gray', name: 'Gray', color: '#bdc3c7' },
]

type PaperSize = 'a4' | 'letter'
type Orientation = 'portrait' | 'landscape'
interface CropState { x: number; y: number; w: number; h: number }

function calcSheetLayout(photoW: number, photoH: number, paper: PaperSize, orientation: Orientation) {
  const mmToPx = 300 / 25.4
  const pw = (paper === 'a4' ? 210 : 216) * mmToPx
  const ph = (paper === 'a4' ? 297 : 279) * mmToPx
  const margin = 10 * mmToPx
  const gap = 4 * mmToPx
  const availW = (orientation === 'portrait' ? pw : ph) - margin * 2
  const availH = (orientation === 'portrait' ? ph : pw) - margin * 2
  const cols = Math.max(1, Math.floor((availW + gap) / (photoW + gap)))
  const rows = Math.max(1, Math.floor((availH + gap) / (photoH + gap)))
  return { paperW: orientation === 'portrait' ? pw : ph, paperH: orientation === 'portrait' ? ph : pw, cols, rows, margin, gap }
}

export function PassportPhotoTool() {
  const [file, setFile] = useState<File | null>(null)
  const [presetId, setPreset] = useState('us-passport')
  const [customW, setCustomW] = useState('600')
  const [customH, setCustomH] = useState('600')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [crop, setCrop] = useState<CropState | null>(null)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [sheetPreview, setSheetPreview] = useState<string | null>(null)
  const [sheetBlob, setSheetBlob] = useState<Blob | null>(null)
  const [paperSize, setPaperSize] = useState<PaperSize>('a4')
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const worker = useImageWorker()
  const pdfWorker = usePdfWorker()

  const currentPreset = PRESETS.find((p) => p.id === presetId)!
  const outW = presetId === 'custom' ? parseInt(customW, 10) || 600 : currentPreset.width
  const outH = presetId === 'custom' ? parseInt(customH, 10) || 600 : currentPreset.height

  const onFiles = useCallback((files: File[]) => { setFile(files[0]); setResult(null); releaseResultUrls(); setCrop(null); setSheetPreview(null); setSheetBlob(null) }, [])

  const processPhoto = useCallback(async () => {
    if (!file || !crop) return
    setResult(null); releaseResultUrls()
    const payload = await fileToImagePayload(file)
    const [cropped] = await worker.run('crop', { files: [payload], opts: { x: crop.x, y: crop.y, width: crop.w, height: crop.h } })
    const [resized] = await worker.run('resize', { files: [{ bytes: cropped.bytes, mime: cropped.mime, name: cropped.name }], opts: { width: outW, height: outH, fit: 'cover' } })
    const [final_] = await worker.run('fill-background', { files: [{ bytes: resized.bytes, mime: resized.mime, name: resized.name }], opts: { color: bgColor } })
    const photoUrl = resultBlobUrl(final_.mime, final_.bytes)
    setResult([{ name: `passport-photo-${outW}x${outH}.png`, url: photoUrl, size: final_.size, detail: `${outW}Ã—${outH}px | ${currentPreset.name}` }])

    const { paperW, paperH, cols, rows, margin, gap } = calcSheetLayout(outW, outH, paperSize, orientation)
    const canvas = new OffscreenCanvas(paperW, paperH)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, paperW, paperH)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((r) => { img.onload = () => r(); img.src = photoUrl })
    await new Promise<void>((r) => setTimeout(r, 50))
    const startX = (paperW - (cols * outW + (cols - 1) * gap)) / 2
    const startY = (paperH - (rows * outH + (rows - 1) * gap)) / 2
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * (outW + gap), y = startY + row * (outH + gap)
        ctx.drawImage(img, x, y, outW, outH)
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
        ctx.strokeRect(x - 2, y - 2, outW + 4, outH + 4); ctx.setLineDash([])
      }
    }
    const sheetBlobOut = await canvas.convertToBlob({ type: 'image/png', quality: 1 })
    setSheetBlob(sheetBlobOut)
    setSheetPreview(URL.createObjectURL(sheetBlobOut))
  }, [file, crop, outW, outH, bgColor, currentPreset, paperSize, orientation, worker])

  const downloadSheetImage = useCallback(() => {
    if (!sheetPreview) return
    const a = document.createElement('a'); a.href = sheetPreview; a.download = `passport-sheet-${paperSize}-${orientation}.png`; a.click()
  }, [sheetPreview, paperSize, orientation])

  const downloadSheetPdf = useCallback(async () => {
    if (!sheetBlob) return
    const arr = new Uint8Array(await sheetBlob.arrayBuffer())
    const res = await pdfWorker.run('images-to-pdf', { files: [arr], mimes: ['image/png'] })
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([res.bytes as BlobPart], { type: 'application/pdf' })); a.download = `passport-sheet-${paperSize}-${orientation}.pdf`; a.click()
  }, [sheetBlob, pdfWorker, paperSize, orientation])

  const reset = useCallback(() => { setFile(null); setResult(null); releaseResultUrls(); setCrop(null); setSheetPreview(null); setSheetBlob(null) }, [])
  const layout = calcSheetLayout(outW, outH, paperSize, orientation)

  return (
    <Card className="relative">
      {!file ? (
        <FileUploader accept={ACCEPT} maxSizeMB={50} multiple={false} onFiles={onFiles} hint="Upload a front-facing photo with good lighting" />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          {/* Country presets */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Country / Document</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPreset(p.id)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                    presetId === p.id ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300'
                  }`}>
                  <span className={`block text-sm font-medium ${presetId === p.id ? 'text-brand-700' : 'text-slate-700'}`}>{p.name}</span>
                  <span className="block text-xs text-slate-400">{p.desc}</span>
                </button>
              ))}
            </div>
            {presetId === 'custom' && (
              <div className="mt-3 flex items-center gap-3">
                <div><label className="mb-1 block text-xs font-medium text-slate-500">Width (px)</label>
                  <input type="number" min={50} max={3000} value={customW} onChange={(e) => setCustomW(e.target.value)} className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" /></div>
                <div><label className="mb-1 block text-xs font-medium text-slate-500">Height (px)</label>
                  <input type="number" min={50} max={3000} value={customH} onChange={(e) => setCustomH(e.target.value)} className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" /></div>
              </div>
            )}
          </div>

          {/* Background */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Background Color</h3>
            <div className="flex flex-wrap gap-2">
              {BG_COLORS.map((bg) => (
                <button key={bg.id} type="button" onClick={() => setBgColor(bg.color)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                    bgColor === bg.color ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-brand-300'
                  }`}>
                  <span className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: bg.color }} />
                  <span className="text-slate-700">{bg.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Print settings */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Print Settings</h3>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Paper</label>
                <div className="flex gap-2">
                  {(['a4', 'letter'] as PaperSize[]).map((ps) => (
                    <button key={ps} type="button" onClick={() => setPaperSize(ps)}
                      className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                        paperSize === ps ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                      }`}>{ps === 'a4' ? 'A4' : 'Letter'}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Orientation</label>
                <div className="flex gap-2">
                  {(['portrait', 'landscape'] as Orientation[]).map((o) => (
                    <button key={o} type="button" onClick={() => setOrientation(o)}
                      className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        orientation === o ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                      }`}>{o}</button>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              <Printer className="mr-1 inline h-3 w-3" />
              {layout.cols}Ã—{layout.rows} = {layout.cols * layout.rows} photos per sheet
            </p>
          </div>

          {/* Crop preview */}
          <PassportCropPreview file={file} aspectRatio={outW / outH} onCrop={setCrop} />

          {/* Result + sheet preview */}
          {result && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">Result</h4>
              <div className="flex flex-wrap gap-4">
                {result.map((item, i) => (
                  <div key={i} className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="Passport photo" className="rounded-lg border border-slate-200 shadow-sm" style={{ maxWidth: 200 }} />
                    <p className="mt-1 text-xs text-slate-400">{outW}Ã—{outH}px</p>
                  </div>
                ))}
              </div>
              {sheetPreview && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-slate-600">Print Sheet Preview ({paperSize.toUpperCase()} {orientation})</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sheetPreview} alt="Print sheet" className="mx-auto max-h-64 rounded-lg border border-slate-200" />
                  <p className="mt-1 text-xs text-slate-400">{layout.cols * layout.rows} photos on sheet</p>
                </div>
              )}
            </div>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}
          {pdfWorker.error && <ErrorAlert message={pdfWorker.error} />}

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!crop} onClick={() => void processPhoto()}>
              <Globe className="mr-1 h-4 w-4" /> Create Passport Photo
            </Button>
            {sheetPreview && <Button variant="outline" onClick={downloadSheetImage}>Download Sheet (PNG)</Button>}
            {sheetBlob && <Button variant="outline" onClick={() => void downloadSheetPdf()}>Download Sheet (PDF)</Button>}
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Creating passport photo...'} progress={worker.progress} onCancel={worker.cancel} />}
          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}

function PassportCropPreview({ file, aspectRatio, onCrop }: { file: File; aspectRatio: number; onCrop: (sel: CropState | null) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [sel, setSel] = useState<CropState | null>(null)
  const dragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  useEffect(() => { const url = URL.createObjectURL(file); setSrc(url); return () => URL.revokeObjectURL(url) }, [file])

  const rectOf = () => { const r = wrapRef.current?.getBoundingClientRect(); return r ?? { left: 0, top: 0, width: 0, height: 0 } }
  const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v))

  const start = (e: React.PointerEvent) => {
    e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); dragging.current = true
    const r = rectOf(); const x = e.clientX - r.left, y = e.clientY - r.top
    startPos.current = { x, y }; setSel({ x, y, w: 0, h: 0 })
  }
  const move = (e: React.PointerEvent) => {
    if (!dragging.current) return; e.preventDefault()
    const r = rectOf(); const cx = clamp(e.clientX - r.left, 0, r.width); const cy = clamp(e.clientY - r.top, 0, r.height)
    setSel((prev) => { if (!prev) return prev; const ox = startPos.current.x; let w = Math.abs(cx - ox); let h = w / aspectRatio; if (h > r.height) { h = r.height; w = h * aspectRatio } const x = Math.min(cx, ox); const y = Math.min(cy, startPos.current.y); return { x, y, w, h } })
  }
  const end = () => { if (!dragging.current) return; dragging.current = false; setSel((prev) => (!prev || prev.w < 5) ? null : prev) }

  useEffect(() => {
    if (!sel || natural.w === 0) { onCrop(null); return }
    const r = rectOf(); const sx = natural.w / (r.width || 1); const sy = natural.h / (r.height || 1)
    onCrop({ x: Math.round(sel.x * sx), y: Math.round(sel.y * sy), w: Math.round(sel.w * sx), h: Math.round((sel.w / aspectRatio) * sy) })
  }, [sel, natural, aspectRatio])

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Select Face Area</h3>
      <div ref={wrapRef} className="relative mx-auto inline-block cursor-crosshair overflow-hidden rounded-xl border border-slate-200 bg-slate-100 touch-none" style={{ maxWidth: '100%' }} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}>
        {src && <img src={src} alt="Photo to crop" className="max-h-[400px] w-auto select-none" draggable={false} onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />}
        {sel && sel.w > 0 && (<><div className="pointer-events-none absolute inset-0 bg-black/40" /><div className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.w / aspectRatio }} /></>)}
      </div>
      <p className="mt-2 text-xs text-slate-400">Drag to select the head/face area.</p>
    </div>
  )
}
