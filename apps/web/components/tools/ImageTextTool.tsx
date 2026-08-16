'use client'

import { useCallback, useRef, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type Position = 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right'

const POSITIONS: Array<{ value: Position; label: string }> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'center', label: 'Center' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
]

export function ImageTextTool() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [color, setColor] = useState('#ffffff')
  const [fontSize, setFontSize] = useState(48)
  const [position, setPosition] = useState<Position>('bottom-center')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null)
    setError(null)
    imageRef.current = null
  }, [])

  const run = useCallback(async () => {
    if (!file || !text.trim()) return
    setError(null)
    setProgress(10)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Could not decode this image.'))
        img.src = URL.createObjectURL(file)
      })
      imageRef.current = image
      setProgress(40)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.drawImage(image, 0, 0)

      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = color
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      const margin = Math.round(canvas.width * 0.04)
      const padding = 16
      const measure = ctx.measureText(text)
      const textW = measure.width + padding * 2
      const textH = fontSize + padding * 2
      const xCenter = canvas.width / 2

      let x = xCenter
      let y = canvas.height / 2
      if (position.includes('left')) x = margin + textW / 2
      if (position.includes('right')) x = canvas.width - margin - textW / 2
      if (position.includes('top')) y = margin + textH / 2
      if (position.includes('bottom')) y = canvas.height - margin - textH / 2

      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillRect(x - textW / 2, y - textH / 2, textW, textH)
      ctx.fillStyle = color
      ctx.fillText(text, x, y)
      setProgress(80)

      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92),
      )
      const base = file.name.replace(/\.[^.]+$/, '')
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      setResult([{ name: `${base}-text.${ext}`, url: URL.createObjectURL(blob), size: blob.size }])
      setProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add text')
    } finally {
      setProgress(null)
    }
  }, [file, text, color, fontSize, position])

  const reset = useCallback(() => {
    setFile(null)
    setText('')
    setResult(null)
    setError(null)
  }, [])

  return (
    <Card>
      {!file ? (
        <FileUploader accept="image/*" maxSizeMB={200} multiple={false} onFiles={onFiles} />
      ) : (
        <div className="space-y-6">
          <FileList files={[file]} onRemove={reset} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Text
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. SALE"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-slate-300"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Size — {fontSize}px
              <input
                type="range"
                min={16}
                max={160}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="mt-3 w-full accent-brand-600"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Position</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPosition(p.value)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    position === p.value
                      ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {(error || result === null) && error && <ErrorAlert message={error} />}

          <Button size="lg" loading={progress !== null} disabled={!text.trim()} onClick={() => void run()}>
            Add Text
          </Button>
          <ProgressBar value={progress} label="Rendering image…" />

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
