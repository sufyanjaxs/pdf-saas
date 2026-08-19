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
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { Type, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'

interface TextLayer {
  id: string
  text: string
  x: number; y: number
  fontSize: number
  fontFamily: string
  color: string
  bold: boolean
  italic: boolean
  shadow: boolean
  opacity: number
}

const FONTS = [
  'Arial', 'Impact', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Comic Sans MS'
]
const COLORS = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

const newLayer = (text = 'Your text'): TextLayer => ({
  id: Math.random().toString(36).slice(2, 10),
  text, x: 50, y: 50, fontSize: 48, fontFamily: 'Arial',
  color: '#ffffff', bold: true, italic: false, shadow: true, opacity: 100,
})

export function ImageTextTool() {
  const [files, setFiles] = useState<File[]>([])
  const [layers, setLayers] = useState<TextLayer[]>([newLayer()])
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [imgSize, setImgSize] = useState({ w: 800, h: 600 })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const worker = useImageWorker()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const onFiles = useCallback(async (incoming: File[]) => {
    const file = incoming[0]; if (!file) return
    setFiles(incoming); setResult(null); setLayers([newLayer()]); setActiveLayer(null)
    await fileToImagePayload(file)
    const url = URL.createObjectURL(file)
    const img = new Image(); img.src = url
    await new Promise<void>((r) => { img.onload = () => { setImgSize({ w: img.naturalWidth, h: img.naturalHeight }); r() } })
    setPreviewUrl(url)
  }, [])

  const active = layers.find((l) => l.id === activeLayer) ?? layers[layers.length - 1]
  const updateLayer = (id: string, patch: Partial<TextLayer>) => setLayers((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l))

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !previewUrl) return
    const ctx = canvas.getContext('2d')!
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      const displayW = Math.min(imgSize.w, 600)
      const displayH = (imgSize.h / imgSize.w) * displayW
      canvas.width = displayW; canvas.height = displayH
      const scaleX = displayW / imgSize.w; const scaleY = displayH / imgSize.h
      ctx.clearRect(0, 0, displayW, displayH)
      ctx.drawImage(img, 0, 0, displayW, displayH)
      layers.forEach((layer) => {
        const x = layer.x * scaleX; const y = layer.y * scaleY
        const fs = layer.fontSize * Math.min(scaleX, scaleY)
        ctx.save()
        ctx.globalAlpha = layer.opacity / 100
        let font = ''; if (layer.italic) font += 'italic '; if (layer.bold) font += 'bold '; font += `${fs}px "${layer.fontFamily}"`
        ctx.font = font; ctx.fillStyle = layer.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        if (layer.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4 * Math.min(scaleX, scaleY); ctx.shadowOffsetX = 2 * scaleX; ctx.shadowOffsetY = 2 * scaleY }
        ctx.fillText(layer.text, x, y)
        ctx.restore()
      })
      ctx.strokeStyle = 'rgba(59,130,246,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
      layers.forEach((layer) => {
        const fs = layer.fontSize * Math.min(scaleX, scaleY)
        ctx.font = `${layer.bold ? 'bold ' : ''}${fs}px "${layer.fontFamily}"`
        const m = ctx.measureText(layer.text)
        const tx = layer.x * scaleX; const ty = layer.y * scaleY
        ctx.strokeRect(tx - m.width / 2 - 4, ty - fs / 2 - 4, m.width + 8, fs + 8)
      })
      ctx.setLineDash([])
    }
    img.src = previewUrl
  }, [layers, previewUrl, imgSize])

  const run = useCallback(async () => {
    if (files.length === 0) return; setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const textLayers = layers.map(({ id, ...rest }) => rest)
    const res = await worker.run('add-text', { files: payloads, opts: { layers: textLayers } })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}×${r.height}px | ${layers.length} layer(s)`
    }))
    setResult(items)
  }, [files, layers, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); setLayers([newLayer()]); setActiveLayer(null); setPreviewUrl(null) }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple={false} maxSizeMB={50} minFiles={1} onFiles={(incoming) => void onFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={reset} />

          {/* Canvas preview */}
          <div className="flex justify-center">
            <canvas ref={canvasRef} className="rounded-xl border border-slate-200 shadow-sm" style={{ maxWidth: '100%' }} />
          </div>

          {/* Layers */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Text Layers</h3>
              <Button size="sm" variant="outline" onClick={() => { const l = newLayer(); setLayers((prev) => [...prev, l]); setActiveLayer(l.id) }}>
                <Plus className="mr-1 h-3 w-3" /> Add Layer
              </Button>
            </div>
            <div className="space-y-1.5">
              {layers.map((layer, i) => (
                <button key={layer.id} type="button" onClick={() => setActiveLayer(layer.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    activeLayer === layer.id || (!activeLayer && i === layers.length - 1)
                      ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}>
                  <Type className="h-3 w-3 flex-shrink-0" />
                  <span className="flex-1 truncate">{layer.text || '(empty)'}</span>
                  <span className="text-[10px] text-slate-400">{layer.fontSize}px</span>
                  {layers.length > 1 && (
                    <span role="button" onClick={(e) => { e.stopPropagation(); setLayers((prev) => prev.filter((l) => l.id !== layer.id)) }}
                      className="ml-1 text-slate-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active layer controls */}
          {active && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Text</label>
                <input type="text" value={active.text} onChange={(e) => updateLayer(active.id, { text: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Font</label>
                  <select value={active.fontFamily} onChange={(e) => updateLayer(active.id, { fontFamily: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500">
                    {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Size</label>
                  <input type="number" min={8} max={200} value={active.fontSize} onChange={(e) => updateLayer(active.id, { fontSize: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => updateLayer(active.id, { color: c })}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${active.color === c ? 'border-brand-600 scale-110' : 'border-slate-200 hover:scale-105'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={active.color} onChange={(e) => updateLayer(active.id, { color: e.target.value })}
                    className="h-7 w-7 cursor-pointer rounded-full border border-slate-200" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={active.bold} onChange={(e) => updateLayer(active.id, { bold: e.target.checked })} className="rounded text-brand-600" /> Bold
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={active.italic} onChange={(e) => updateLayer(active.id, { italic: e.target.checked })} className="rounded text-brand-600" /> Italic
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={active.shadow} onChange={(e) => updateLayer(active.id, { shadow: e.target.checked })} className="rounded text-brand-600" /> Shadow
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Opacity</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} value={active.opacity} onChange={(e) => updateLayer(active.id, { opacity: Number(e.target.value) })} className="flex-1 accent-brand-600" />
                  <span className="w-10 text-center text-xs font-bold text-slate-700">{active.opacity}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Position X</label>
                  <input type="range" min={0} max={imgSize.w} value={active.x} onChange={(e) => updateLayer(active.id, { x: Number(e.target.value) })} className="w-full accent-brand-600" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Position Y</label>
                  <input type="range" min={0} max={imgSize.h} value={active.y} onChange={(e) => updateLayer(active.id, { y: Number(e.target.value) })} className="w-full accent-brand-600" />
                </div>
              </div>
            </div>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              <Type className="mr-1 h-4 w-4" /> Add Text
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Adding text...'} progress={worker.progress} onCancel={worker.cancel} />}
          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
