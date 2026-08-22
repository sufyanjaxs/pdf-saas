'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection, OptionButton } from './ToolWorkspace'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'

const ACCEPT = 'image/jpeg,image/png,image/webp'

type PageSize = 'a4' | 'letter' | 'original' | 'fit'
type Orientation = 'portrait' | 'landscape' | 'auto'

const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

const MARGINS = [
  { value: 0, label: 'None' },
  { value: 8, label: 'Tiny' },
  { value: 12, label: 'Small' },
  { value: 24, label: 'Medium' },
  { value: 36, label: 'Large' },
]

export function JpgToPdfTool() {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [pageSize, setPageSize] = useState<PageSize>('a4')
  const [orientation, setOrientation] = useState<Orientation>('auto')
  const [margin, setMargin] = useState(12)
  const [fitMode, setFitMode] = useState<'contain' | 'fill'>('contain')
  const worker = usePdfWorker()
  const previewRef = useRef<HTMLCanvasElement>(null)

  const move = useCallback((index: number, dir: -1 | 1) => {
    setFiles((prev) => { const next = [...prev]; const j = index + dir; if (j < 0 || j >= next.length) return prev; [next[index], next[j]] = [next[j], next[index]]; return next })
  }, [])

  // Live page preview
  useEffect(() => {
    if (files.length === 0 || !previewRef.current) return
    const canvas = previewRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pageW = pageSize === 'original' ? 612 : (PAGE_SIZES[pageSize]?.[0] ?? 595.28)
    const pageH = pageSize === 'original' ? 792 : (PAGE_SIZES[pageSize]?.[1] ?? 841.89)
    const isLandscape = orientation === 'landscape' || (orientation === 'auto' && files[0])
    const displayW = isLandscape ? pageH : pageW
    const displayH = isLandscape ? pageW : pageH
    const scale = Math.min(500 / displayW, 400 / displayH)
    canvas.width = Math.round(displayW * scale)
    canvas.height = Math.round(displayH * scale)

    // Draw page
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw margin guide
    const m = margin * scale
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(m, m, canvas.width - m * 2, canvas.height - m * 2)
    ctx.setLineDash([])

    // Draw image preview
    const img = new Image()
    img.onload = () => {
      const availW = canvas.width - m * 2
      const availH = canvas.height - m * 2
      let drawW: number, drawH: number, drawX: number, drawY: number

      if (fitMode === 'contain') {
        const ratio = Math.min(availW / img.naturalWidth, availH / img.naturalHeight)
        drawW = img.naturalWidth * ratio
        drawH = img.naturalHeight * ratio
      } else {
        const ratio = Math.max(availW / img.naturalWidth, availH / img.naturalHeight)
        drawW = img.naturalWidth * ratio
        drawH = img.naturalHeight * ratio
      }
      drawX = m + (availW - drawW) / 2
      drawY = m + (availH - drawH) / 2
      ctx.drawImage(img, drawX, drawY, drawW, drawH)

      // Page label
      ctx.fillStyle = '#64748b'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`Page 1 â€” ${pageSize === 'original' ? 'Original Size' : pageSize.toUpperCase()} ${orientation === 'auto' ? '' : orientation}`, canvas.width / 2, canvas.height - 6)
    }
    img.src = URL.createObjectURL(files[0])
  }, [files, pageSize, orientation, margin, fitMode])

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null); releaseResultUrls()
    const arrays = await Promise.all(files.map((f) => f.arrayBuffer()))
    const res = await worker.run('images-to-pdf', {
      files: arrays.map((b) => new Uint8Array(b)),
      mimes: files.map((f) => f.type),
      pageSize: pageSize === 'original' ? undefined : PAGE_SIZES[pageSize],
      orientation,
      margin,
      fitMode,
    } as any)
    const name = `images-${files.length}-pages.pdf`
    setResult([{ name, url: resultBlobUrl('application/pdf', res.bytes), size: res.bytes.byteLength, detail: `${files.length} image${files.length === 1 ? '' : 's'} | ${pageSize.toUpperCase()} ${orientation === 'auto' ? '' : orientation}` }])
  }, [files, worker, pageSize, orientation, margin, fitMode])

  const reset = useCallback(() => { setFiles([]); setResult(null); releaseResultUrls() }, [])

  if (files.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} hint="Drop JPG, PNG or WEBP images, or browse" onFiles={(incoming) => setFiles(incoming)} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="flex h-full items-center justify-center p-4">
          <canvas ref={previewRef} className="max-h-full rounded bg-white shadow-lg" />
        </div>
      }
      controls={
        <>
          <ControlSection title={`${files.length} Image${files.length === 1 ? '' : 's'}`}>
            <FileList files={files} reorderable onMove={move} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />
            <button type="button" className="mt-2 text-xs text-brand-600 hover:underline" onClick={reset}>Change images</button>
          </ControlSection>

          <ControlSection title="Page Size">
            <div className="flex flex-wrap gap-2">
              {(['a4', 'letter', 'original', 'fit'] as PageSize[]).map((ps) => (
                <OptionButton key={ps} selected={pageSize === ps} onClick={() => setPageSize(ps)}>
                  {ps === 'a4' ? 'A4' : ps === 'letter' ? 'US Letter' : ps === 'original' ? 'Original' : 'Fit to Image'}
                </OptionButton>
              ))}
            </div>
          </ControlSection>

          <ControlSection title="Orientation">
            <div className="flex gap-2">
              {(['auto', 'portrait', 'landscape'] as Orientation[]).map((o) => (
                <OptionButton key={o} selected={orientation === o} onClick={() => setOrientation(o)}>
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </OptionButton>
              ))}
            </div>
          </ControlSection>

          <ControlSection title="Margins">
            <div className="flex flex-wrap gap-2">
              {MARGINS.map((m) => (
                <OptionButton key={m.value} selected={margin === m.value} onClick={() => setMargin(m.value)}>
                  {m.label}
                </OptionButton>
              ))}
            </div>
          </ControlSection>

          {pageSize !== 'fit' && pageSize !== 'original' && (
            <ControlSection title="Image Fit">
              <div className="flex gap-2">
                <OptionButton selected={fitMode === 'contain'} onClick={() => setFitMode('contain')}>
                  Fit Inside
                </OptionButton>
                <OptionButton selected={fitMode === 'fill'} onClick={() => setFitMode('fill')}>
                  Fill Page
                </OptionButton>
              </div>
            </ControlSection>
          )}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              Create PDF
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Creating PDF...'} progress={worker.progress} onCancel={worker.cancel} />}
          {worker.error && <ErrorAlert message={worker.error} />}
        </>
      }
    />
  )
}
