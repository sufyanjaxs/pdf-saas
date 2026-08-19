'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'

type Format = 'image/jpeg' | 'image/webp' | 'image/png' | 'original'
type ModeId = 'extreme' | 'high' | 'balanced' | 'hq' | 'max' | 'custom'

interface CompMode {
  id: ModeId
  name: string
  desc: string
  quality: number
  format: Format
}

const MODES: CompMode[] = [
  { id: 'extreme', name: 'Extreme', desc: 'Smallest file', quality: 25, format: 'image/webp' },
  { id: 'high', name: 'High', desc: 'Small file', quality: 50, format: 'image/webp' },
  { id: 'balanced', name: 'Balanced', desc: 'Best trade-off', quality: 75, format: 'image/jpeg' },
  { id: 'hq', name: 'High Quality', desc: 'Nearly lossless', quality: 85, format: 'image/jpeg' },
  { id: 'max', name: 'Maximum', desc: 'Best possible', quality: 95, format: 'image/jpeg' },
  { id: 'custom', name: 'Custom', desc: 'You decide', quality: 80, format: 'original' },
]

const TARGET_PRESETS = [
  { kb: 50, label: '50 KB' },
  { kb: 100, label: '100 KB' },
  { kb: 200, label: '200 KB' },
  { kb: 500, label: '500 KB' },
  { kb: 1024, label: '1 MB' },
]

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'

interface ContentInfo {
  type: string
  badge: string
  badgeColor: string
  warning?: string
}

function detectContentType(f: File, hasAlpha: boolean): ContentInfo {
  if (hasAlpha) return { type: 'transparent-png', badge: 'Transparent PNG', badgeColor: 'bg-violet-100 text-violet-700' }
  const isJpeg = f.type === 'image/jpeg'
  const size = f.size
  if (isJpeg && size < 50_000) return { type: 'thumbnail', badge: 'Thumbnail', badgeColor: 'bg-slate-100 text-slate-600' }
  if (f.type === 'image/png' && !hasAlpha) return { type: 'screenshot', badge: 'Screenshot', badgeColor: 'bg-blue-100 text-blue-700' }
  if (isJpeg && size > 200_000) return { type: 'photo', badge: 'Photo', badgeColor: 'bg-emerald-100 text-emerald-700' }
  if (isJpeg) return { type: 'photo', badge: 'Photo', badgeColor: 'bg-emerald-100 text-emerald-700' }
  if (f.type === 'image/png') return { type: 'graphic', badge: 'Graphic', badgeColor: 'bg-amber-100 text-amber-700' }
  return { type: 'photo', badge: 'Image', badgeColor: 'bg-slate-100 text-slate-600' }
}

function getMinQuality(contentType: string): number {
  if (contentType === 'graphic') return 75
  if (contentType === 'screenshot') return 70
  if (contentType === 'thumbnail') return 60
  return 5
}

export function ImageCompressorTool() {
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<ModeId>('balanced')
  const [quality, setQuality] = useState(75)
  const [format, setFormat] = useState<Format>('image/jpeg')
  const [targetMode, setTargetMode] = useState(false)
  const [targetSizeKB, setTargetSizeKB] = useState('200')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [resultSummary, setResultSummary] = useState('')
  const [beforeAfter, setBeforeAfter] = useState<{ originalSize: number; compressedSize: number; originalUrl?: string; compressedUrl?: string } | null>(null)
  const [contentInfo, setContentInfo] = useState<ContentInfo | null>(null)
  const [pngWarn, setPngWarn] = useState(false)
  const worker = useImageWorker()

  const applyMode = useCallback((m: CompMode) => {
    setMode(m.id)
    setQuality(m.quality)
    if (m.format !== 'original') setFormat(m.format)
  }, [])

  const onFiles = useCallback(async (incoming: File[]) => {
    setFiles(incoming)
    setResult(null)
    setBeforeAfter(null)
    if (incoming.length === 1) {
      const f = incoming[0]
      const hasAlpha = f.type === 'image/png' || f.type === 'image/webp'
      const info = detectContentType(f, hasAlpha)
      setContentInfo(info)
      if (info.type === 'transparent-png') setFormat('image/webp')
    } else {
      setContentInfo(null)
    }
  }, [])

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    setBeforeAfter(null)
    setPngWarn(false)

    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const originalUrl = files.length === 1 ? URL.createObjectURL(files[0]) : undefined

    const effectiveFormat = format === 'original'
      ? (files[0]?.type === 'image/png' ? 'image/png' : files[0]?.type === 'image/webp' ? 'image/webp' : 'image/jpeg')
      : format

    if (format === 'image/jpeg' && files.some((f) => f.type === 'image/png')) {
      setPngWarn(true)
    }

    if (targetMode && targetSizeKB) {
      const minQ = contentInfo ? getMinQuality(contentInfo.type) : 5
      const res = await worker.run('compress-advanced', {
        files: payloads,
        opts: {
          format: effectiveFormat,
          targetSizeKB: parseInt(targetSizeKB, 10),
          quality,
          minQuality: minQ,
        },
      })
      const items: ResultItem[] = res.map((r: any) => ({
        name: r.name,
        url: resultBlobUrl(r.mime, r.bytes),
        size: r.size,
        detail: `${r.width}x${r.height} | q${r.quality}`,
      }))
      const before = files.reduce((s, f) => s + f.size, 0)
      const after = res.reduce((s: number, r: any) => s + r.size, 0)
      const savedPct = before > 0 ? Math.round((1 - after / before) * 100) : 0
      setBeforeAfter({ originalSize: before, compressedSize: after, originalUrl, compressedUrl: items[0]?.url })
      setResultSummary(`Target: ${targetSizeKB}KB — Achieved: ${formatBytes(after)} (${savedPct}% smaller)`)
      setResult(items)
    } else {
      const effectiveQ = format === 'image/png' ? undefined : quality / 100
      const res = await worker.run('compress-advanced', {
        files: payloads,
        opts: { format: effectiveFormat, quality, minQuality: contentInfo ? getMinQuality(contentInfo.type) : undefined },
      })
      const items: ResultItem[] = res.map((r: any) => ({
        name: r.name,
        url: resultBlobUrl(r.mime, r.bytes),
        size: r.size,
        detail: `${r.width}x${r.height} | q${r.quality}`,
      }))
      const before = files.reduce((s, f) => s + f.size, 0)
      const after = res.reduce((s: number, r: any) => s + r.size, 0)
      const savedPct = before > 0 ? Math.round((1 - after / before) * 100) : 0
      setBeforeAfter({ originalSize: before, compressedSize: after, originalUrl, compressedUrl: items[0]?.url })
      setResultSummary(`Saved ${formatBytes(before - after)} — ${savedPct}% smaller`)
      setResult(items)
    }
  }, [files, format, quality, targetMode, targetSizeKB, worker, contentInfo])

  const reset = useCallback(() => {
    setFiles([])
    setResult(null)
    setResultSummary('')
    setBeforeAfter(null)
    setContentInfo(null)
    setPngWarn(false)
    setTargetMode(false)
    setTargetSizeKB('200')
    setMode('balanced')
    setQuality(75)
    setFormat('image/jpeg')
  }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => void onFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

          {contentInfo && (
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${contentInfo.badgeColor}`}>{contentInfo.badge}</span>
              {contentInfo.type === 'screenshot' && <span className="text-xs text-slate-400">Screenshots work best with PNG or high-quality JPEG</span>}
              {contentInfo.type === 'graphic' && <span className="text-xs text-slate-400">Graphics may show JPEG artifacts at low quality</span>}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Compression Mode</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {MODES.map((m) => (
                <button key={m.id} type="button" onClick={() => applyMode(m)}
                  className={`rounded-lg border-2 px-2 py-2 text-center transition-colors ${
                    mode === m.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-brand-300'
                  }`}>
                  <span className={`block text-xs font-semibold ${mode === m.id ? 'text-brand-700' : 'text-slate-700'}`}>{m.name}</span>
                  <span className="block text-[10px] text-slate-400">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={targetMode} onChange={(e) => setTargetMode(e.target.checked)} className="text-brand-600" />
              Target file size
            </label>
          </div>

          {targetMode && (
            <div className="flex flex-wrap items-center gap-2">
              {TARGET_PRESETS.map((tp) => (
                <button key={tp.kb} type="button" onClick={() => setTargetSizeKB(String(tp.kb))}
                  className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                    targetSizeKB === String(tp.kb) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}>{tp.label}</button>
              ))}
              <input type="number" min={1} max={50000} value={targetSizeKB} onChange={(e) => setTargetSizeKB(e.target.value)}
                placeholder="Custom KB" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500" />
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Output format</h3>
              <div className="flex flex-wrap gap-2">
                {(['original', 'image/jpeg', 'image/webp', 'image/png'] as Format[]).map((f) => (
                  <button key={f} type="button" onClick={() => setFormat(f)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                      format === f ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                    }`}>
                    {f === 'original' ? 'Original' : f === 'image/jpeg' ? 'JPG' : f === 'image/webp' ? 'WebP' : 'PNG'}
                  </button>
                ))}
              </div>
            </div>
            {!targetMode && format !== 'image/png' && mode !== 'custom' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Quality</h3>
                  <span className="text-sm tabular-nums text-slate-500">{quality}%</span>
                </div>
                <input type="range" min={1} max={100} value={quality} onChange={(e) => { setQuality(Number(e.target.value)); setMode('custom'); setFormat(e.target.value as any || 'image/jpeg') }}
                  className="w-full accent-brand-600" />
              </div>
            )}
            {mode === 'custom' && !targetMode && format !== 'image/png' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Quality</h3>
                  <span className="text-sm tabular-nums text-slate-500">{quality}%</span>
                </div>
                <input type="range" min={1} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-brand-600" />
                <div className="mt-1 flex justify-between text-xs text-slate-400"><span>Smaller file</span><span>Higher quality</span></div>
              </div>
            )}
          </div>

          {pngWarn && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              JPEG does not support transparency. Transparent areas will be filled with white. Consider WebP for better results.
            </div>
          )}

          {contentInfo?.type === 'screenshot' && (
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Screenshot detected. For text clarity, consider using PNG format or quality 80+.
            </div>
          )}

          {contentInfo?.type === 'graphic' && mode === 'extreme' && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Extreme compression may cause visible artifacts on graphics. Consider Balanced or higher.
            </div>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0 || (targetMode && !targetSizeKB)} onClick={() => void run()}>
              Compress {files.length} image{files.length === 1 ? '' : 's'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Compressing...'} progress={worker.progress} onCancel={worker.cancel} />}

          {beforeAfter && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">Result</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-1">Original</p>
                  <p className="text-lg font-bold text-slate-700">{formatBytes(beforeAfter.originalSize)}</p>
                  {beforeAfter.originalUrl && (
                    <div className="mt-2 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={beforeAfter.originalUrl} alt="Original" className="max-h-32 rounded-lg border border-slate-100" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-1">Compressed</p>
                  <p className="text-lg font-bold text-emerald-600">{formatBytes(beforeAfter.compressedSize)}</p>
                  {beforeAfter.compressedUrl && (
                    <div className="mt-2 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={beforeAfter.compressedUrl} alt="Compressed" className="max-h-32 rounded-lg border border-slate-100" />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 text-sm">
                <span className="font-semibold text-emerald-600">-{formatBytes(Math.max(0, beforeAfter.originalSize - beforeAfter.compressedSize))}</span>
                <span className="text-slate-300">|</span>
                <span className="font-semibold text-emerald-600">{beforeAfter.originalSize > 0 ? Math.round((1 - beforeAfter.compressedSize / beforeAfter.originalSize) * 100) : 0}% smaller</span>
              </div>
            </div>
          )}

          {result && <ResultPanel items={result} summary={resultSummary} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
