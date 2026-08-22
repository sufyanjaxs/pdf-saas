'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection, InfoBar, StatBlock } from './ToolWorkspace'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'
import { ArrowRight, Lock, Unlock, ImageIcon } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

interface ResizePreset {
  id: string
  label: string
  width: number
  height: number
  desc: string
  category: 'size' | 'platform' | 'document'
  emoji?: string
}

const PRESETS: ResizePreset[] = [
  { id: 'original', label: 'Original', width: 0, height: 0, desc: 'Keep original', category: 'size' },
  { id: 'small', label: 'Small', width: 640, height: 480, desc: '640Ã—480', category: 'size' },
  { id: 'medium', label: 'Medium', width: 1280, height: 720, desc: '1280Ã—720', category: 'size' },
  { id: 'large', label: 'Large', width: 1920, height: 1080, desc: '1920Ã—1080', category: 'size' },
  { id: 'web', label: 'Web', width: 1200, height: 800, desc: '1200Ã—800', category: 'size' },
  { id: 'email', label: 'Email', width: 600, height: 400, desc: '600Ã—400', category: 'size' },
  { id: 'ig-square', label: 'Instagram Square', width: 1080, height: 1080, desc: 'Feed post', category: 'platform', emoji: 'ðŸ“¸' },
  { id: 'ig-portrait', label: 'Instagram Portrait', width: 1080, height: 1350, desc: '4:5 feed', category: 'platform', emoji: 'ðŸ“±' },
  { id: 'ig-story', label: 'Instagram Story', width: 1080, height: 1920, desc: '9:16 vertical', category: 'platform', emoji: 'âœ¨' },
  { id: 'fb-post', label: 'Facebook Post', width: 1200, height: 630, desc: 'Link preview', category: 'platform', emoji: 'ðŸ‘¥' },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', width: 1280, height: 720, desc: '16:9 thumbnail', category: 'platform', emoji: 'ðŸŽ¬' },
  { id: 'linkedin', label: 'LinkedIn', width: 1200, height: 627, desc: 'Share image', category: 'platform', emoji: 'ðŸ’¼' },
  { id: 'tiktok', label: 'TikTok', width: 1080, height: 1920, desc: '9:16 vertical', category: 'platform', emoji: 'ðŸŽµ' },
  { id: 'passport', label: 'Passport', width: 600, height: 600, desc: '1:1 square', category: 'document' },
  { id: 'custom', label: 'Custom', width: 0, height: 0, desc: 'Your size', category: 'size' },
]

export function ImageResizerTool() {
  const [files, setFiles] = useState<File[]>([])
  const [presetId, setPreset] = useState('large')
  const [customW, setCustomW] = useState('1920')
  const [customH, setCustomH] = useState('1080')
  const [keepRatio, setKeepRatio] = useState(true)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [origDims, setOrigDims] = useState<{ w: number; h: number } | null>(null)
  const [origSize, setOrigSize] = useState(0)
  const worker = useImageWorker()
  const previewRef = useRef<HTMLCanvasElement>(null)

  const onFiles = useCallback(async (incoming: File[]) => {
    setFiles(incoming)
    setResult(null); releaseResultUrls()
    if (incoming.length > 0) {
      const f = incoming[0]
      setOrigSize(f.size)
      const img = new Image()
      await new Promise<void>((r) => {
        img.onload = () => { setOrigDims({ w: img.naturalWidth, h: img.naturalHeight }); r() }
        img.src = URL.createObjectURL(f)
      })
    }
  }, [])

  const currentPreset = PRESETS.find((p) => p.id === presetId)!
  const outW = presetId === 'original' ? (origDims?.w ?? 1920) : presetId === 'custom' ? parseInt(customW, 10) || 1920 : currentPreset.width
  const outH = presetId === 'original' ? (origDims?.h ?? 1080) : presetId === 'custom' ? parseInt(customH, 10) || 1080 : currentPreset.height

  // Live preview on canvas
  useEffect(() => {
    if (!files[0] || !previewRef.current || !origDims) return
    const canvas = previewRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      const maxPreviewW = 600
      const maxPreviewH = 400
      const previewW = Math.min(outW, maxPreviewW)
      const previewH = Math.round((outH / outW) * previewW)
      canvas.width = previewW
      canvas.height = Math.min(previewH, maxPreviewH)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = URL.createObjectURL(files[0])
  }, [files, outW, outH, origDims])

  const estimatedSize = origDims ? Math.round(origSize * (outW * outH) / (origDims.w * origDims.h)) : 0

  const run = useCallback(async () => {
    if (files.length === 0 || !outW || !outH) return
    setResult(null); releaseResultUrls()
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('resize', {
      files: payloads,
      opts: { width: outW, height: keepRatio ? undefined : outH, fit: keepRatio ? 'contain' : 'stretch' },
    })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size,
      detail: `${r.width}Ã—${r.height} | ${currentPreset.label}`,
    }))
    setResult(items)
  }, [files, outW, outH, keepRatio, currentPreset, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); releaseResultUrls(); setOrigDims(null); setOrigSize(0) }, [])

  if (files.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="flex h-full flex-col items-center justify-center p-4">
          <canvas ref={previewRef} className="max-h-[50vh] max-w-full rounded bg-white shadow-sm" />
          {origDims && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="text-[10px] text-slate-400">Original</p>
                <p className="font-semibold text-slate-700">{origDims.w}Ã—{origDims.h}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300" />
              <div className="text-center">
                <p className="text-[10px] text-slate-400">Output</p>
                <p className="font-semibold text-brand-600">{outW}Ã—{outH}</p>
              </div>
              {estimatedSize > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400">Est. size</p>
                    <p className="font-semibold text-slate-700">{formatBytes(estimatedSize)}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      }
      controls={
        <>
          <ControlSection title="Resize to">
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setPreset(p.id); if (p.width > 0) { setCustomW(String(p.width)); setCustomH(String(p.height)) } }}
                  className={`preset-card ${presetId === p.id ? 'preset-card-active' : 'preset-card-inactive'}`}
                >
                  {p.emoji && <span className="block text-lg mb-0.5">{p.emoji}</span>}
                  <span className={`block text-xs font-medium ${presetId === p.id ? 'text-brand-700' : 'text-slate-700'}`}>{p.label}</span>
                  <span className="block text-[10px] text-slate-400">{p.desc}</span>
                </button>
              ))}
            </div>
            {presetId === 'custom' && (
              <div className="mt-3 flex items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Width</label>
                  <input type="number" min={1} max={10000} value={customW} onChange={(e) => setCustomW(e.target.value)}
                    className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
                </div>
                <div className="mb-1.5">
                  <button
                    type="button"
                    onClick={() => setKeepRatio(!keepRatio)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      keepRatio ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {keepRatio ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Height</label>
                  <input type="number" min={1} max={10000} value={customH} onChange={(e) => setCustomH(e.target.value)}
                    className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
                </div>
              </div>
            )}
          </ControlSection>

          <ControlSection title="Options">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} className="rounded text-brand-600" />
              Keep aspect ratio
            </label>
          </ControlSection>

          <InfoBar>
            {origDims && <StatBlock label="Original" value={`${origDims.w} Ã— ${origDims.h}`} />}
            <StatBlock label="Output" value={`${outW} Ã— ${outH}`} />
            <StatBlock label="Original size" value={formatBytes(origSize)} />
            {estimatedSize > 0 && (
              <StatBlock
                label="Estimated"
                value={formatBytes(estimatedSize)}
                accent={estimatedSize < origSize}
              />
            )}
          </InfoBar>

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              <ArrowRight className="mr-1 h-4 w-4" /> Resize {files.length} Image{files.length === 1 ? '' : 's'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}
          {worker.running && <ProcessingOverlay label={worker.label || 'Resizing images...'} progress={worker.progress} onCancel={worker.cancel} />}

          <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-slate-700">
            Choose different images
          </button>
        </>
      }
    />
  )
}
