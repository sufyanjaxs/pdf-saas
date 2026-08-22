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
import { Hash } from 'lucide-react'

type Position = 'bottom-right' | 'bottom-center' | 'top-right' | 'top-center'

const POSITIONS: Array<{ value: Position; label: string; desc: string }> = [
  { value: 'bottom-right', label: 'Bottom right', desc: 'Classic position' },
  { value: 'bottom-center', label: 'Bottom center', desc: 'Centered footer' },
  { value: 'top-right', label: 'Top right', desc: 'Header corner' },
  { value: 'top-center', label: 'Top center', desc: 'Centered header' },
]

const FONT_SIZES = [8, 10, 12, 14, 16, 20]

export function PdfPageNumbersTool() {
  const [file, setFile] = useState<File | null>(null)
  const [position, setPosition] = useState<Position>('bottom-right')
  const [format, setFormat] = useState('Page {n} of {total}')
  const [fontSize, setFontSize] = useState(10)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const { pages, loading, load } = usePdfPages()
  const worker = usePdfWorker()

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]
    setFile(f)
    setResult(null); releaseResultUrls()
    void load(f)
  }, [load])

  // Draw page number preview on canvas
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

      // Draw sample page number
      const sampleText = format.replace('{n}', '1').replace('{total}', String(pages.length || '1'))
      const fs = fontSize * scale

      ctx.save()
      ctx.font = `Arial, sans-serif`
      ctx.fillStyle = '#000000'
      ctx.textBaseline = 'middle'

      const textWidth = ctx.measureText(sampleText).width
      const margin = 20 * scale
      let x: number, y: number

      if (position.includes('right')) x = canvas.width - textWidth - margin
      else if (position.includes('center')) x = (canvas.width - textWidth) / 2
      else x = margin

      if (position.startsWith('top')) y = margin + fs / 2
      else y = canvas.height - margin - fs / 2

      ctx.font = `bold ${fs}px Arial, sans-serif`

      // Draw background pill
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      const pad = 6 * scale
      ctx.beginPath()
      ctx.roundRect(x - pad, y - fs / 2 - pad, textWidth + pad * 2, fs + pad * 2, 4 * scale)
      ctx.fill()

      // Draw text
      ctx.fillStyle = '#1e293b'
      ctx.fillText(sampleText, x, y)
      ctx.restore()
    }
    img.src = page.dataUrl
  }, [pages, position, format, fontSize])

  const run = useCallback(async () => {
    if (!file) return
    const bytes = await file.arrayBuffer()
    const res = await worker.run('page-numbers', {
      bytes: new Uint8Array(bytes),
      position,
      format,
    })
    setResult([
      {
        name: defaultOutputName(file.name, 'numbered', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, position, format, worker])

  const reset = useCallback(() => {
    setFile(null)
    setPosition('bottom-right')
    setFormat('Page {n} of {total}')
    setFontSize(10)
    setResult(null); releaseResultUrls()
  }, [])

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="flex h-full items-center justify-center p-4">
          {loading ? (
            <div className="text-sm text-slate-400">Loading PDF preview...</div>
          ) : pages.length > 0 ? (
            <canvas ref={previewRef} className="max-h-full max-w-full rounded bg-white shadow-lg" />
          ) : (
            <div className="text-center text-sm text-slate-400">Upload a PDF to preview page numbers</div>
          )}
        </div>
      }
      controls={
        <>
          <FileList files={[file]} onRemove={reset} />

          <ControlSection title="Position">
            <div className="grid grid-cols-2 gap-2">
              {POSITIONS.map((p) => (
                <button key={p.value} type="button" onClick={() => setPosition(p.value)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                    position === p.value ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300'
                  }`}>
                  <span className={`block text-sm font-medium ${position === p.value ? 'text-brand-700' : 'text-slate-700'}`}>{p.label}</span>
                  <span className="block text-[10px] text-slate-400">{p.desc}</span>
                </button>
              ))}
            </div>
          </ControlSection>

          <ControlSection title="Format">
            <p className="mb-2 text-xs text-slate-400">Use {'{n}'} for page number and {'{total}'} for total pages</p>
            <input type="text" value={format} onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            <div className="mt-2 flex flex-wrap gap-2">
              {['Page {n} of {total}', '{n} / {total}', '- {n} -', '{n}'].map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    format === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </ControlSection>

          <ControlSection title="Font Size">
            <div className="flex flex-wrap gap-2">
              {FONT_SIZES.map((s) => (
                <button key={s} type="button" onClick={() => setFontSize(s)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    fontSize === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {s}pt
                </button>
              ))}
            </div>
          </ControlSection>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={!file} onClick={() => void run()}>
              <Hash className="mr-1 h-4 w-4" /> Add Page Numbers
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Adding page numbersâ€¦'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
