'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { usePdfPages } from '@/hooks/usePdfPages'
import { defaultOutputName, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'

export function PdfWatermarkTool() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(25)
  const [fontSize, setFontSize] = useState(48)
  const [rotation, setRotation] = useState(-45)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const { pages, loading, load } = usePdfPages()
  const worker = usePdfWorker()
  const previewRef = useRef<HTMLCanvasElement>(null)

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null); releaseResultUrls()
    await load(f)
  }, [load])

  // Draw watermark preview on canvas
  useEffect(() => {
    if (pages.length === 0 || !previewRef.current) return
    const canvas = previewRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const page = pages[0]
    const img = new Image()
    img.onload = () => {
      const maxW = 500
      const scale = Math.min(maxW / img.naturalWidth, 1)
      canvas.width = img.naturalWidth * scale
      canvas.height = img.naturalHeight * scale
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Draw watermark text
      ctx.save()
      ctx.globalAlpha = opacity / 100
      ctx.font = `bold ${fontSize * scale}px Arial, sans-serif`
      ctx.fillStyle = '#000000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }
    img.src = page.dataUrl
  }, [pages, text, opacity, fontSize, rotation])

  const run = useCallback(async () => {
    if (!file || !text.trim()) return
    setResult(null); releaseResultUrls()
    const bytes = await file.arrayBuffer()
    const res = await worker.run('watermark', {
      bytes: new Uint8Array(bytes),
      text: text.trim(),
      opacity: opacity / 100,
      size: fontSize,
    })
    setResult([
      {
        name: defaultOutputName(file.name, 'watermarked', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, text, opacity, fontSize, worker])

  const reset = useCallback(() => {
    setFile(null)
    setText('CONFIDENTIAL')
    setOpacity(25)
    setFontSize(48)
    setRotation(-45)
    setResult(null); releaseResultUrls()
  }, [])

  return (
    <ToolWorkspace
      preview={
        <div className="flex h-full items-center justify-center p-4">
          {loading ? (
            <div className="text-sm text-slate-400">Loading PDF preview...</div>
          ) : pages.length > 0 ? (
            <canvas ref={previewRef} className="max-h-full max-w-full rounded bg-white shadow-lg" />
          ) : (
            <div className="text-center text-sm text-slate-400">Upload a PDF to preview watermark</div>
          )}
        </div>
      }
      controls={
        <>
          {file && <FileList files={[file]} onRemove={reset} />}

          <ControlSection title="Watermark Text">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. CONFIDENTIAL"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </ControlSection>

          <ControlSection title="Appearance">
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500">Opacity</label>
                  <span className="text-xs font-semibold text-brand-600">{opacity}%</span>
                </div>
                <input
                  type="range" min={5} max={60} value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500">Font Size</label>
                  <span className="text-xs font-semibold text-brand-600">{fontSize}px</span>
                </div>
                <input
                  type="range" min={12} max={120} value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500">Rotation</label>
                  <span className="text-xs font-semibold text-brand-600">{rotation}Â°</span>
                </div>
                <input
                  type="range" min={-90} max={90} value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!file || !text.trim()} onClick={() => void run()}>
              Add Watermark
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Adding watermark...'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </>
      }
    />
  )
}
