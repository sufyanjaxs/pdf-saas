'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BeforeAfterSlider } from '@/components/ui/before-after-slider'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'
import { ShieldCheck, TrendingDown, Zap, Target, Settings2, AlertTriangle } from 'lucide-react'

type Format = 'image/jpeg' | 'image/webp' | 'image/png' | 'original'

interface CompPreset {
  id: string
  name: string
  desc: string
  icon: React.ReactNode
  quality: number
  format: Format
}

const PRESETS: CompPreset[] = [
  { id: 'max', name: 'Maximum Quality', desc: 'Minimal quality loss', icon: <ShieldCheck className="h-5 w-5" />, quality: 95, format: 'image/jpeg' },
  { id: 'high', name: 'High Quality', desc: 'Excellent quality, smaller file', icon: <Zap className="h-5 w-5" />, quality: 85, format: 'image/jpeg' },
  { id: 'balanced', name: 'Balanced', desc: 'Good quality and strong compression', icon: <TrendingDown className="h-5 w-5" />, quality: 75, format: 'image/jpeg' },
  { id: 'small', name: 'Small File', desc: 'Smallest practical file', icon: <Target className="h-5 w-5" />, quality: 50, format: 'image/webp' },
  { id: 'custom', name: 'Custom', desc: 'You decide', icon: <Settings2 className="h-5 w-5" />, quality: 80, format: 'original' },
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
  if (isJpeg && f.size < 50_000) return { type: 'thumbnail', badge: 'Thumbnail', badgeColor: 'bg-slate-100 text-slate-600' }
  if (f.type === 'image/png' && !hasAlpha) return { type: 'screenshot', badge: 'Screenshot', badgeColor: 'bg-blue-100 text-blue-700' }
  if (isJpeg && f.size > 200_000) return { type: 'photo', badge: 'Photo', badgeColor: 'bg-emerald-100 text-emerald-700' }
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
  const [presetId, setPresetId] = useState('balanced')
  const [quality, setQuality] = useState(75)
  const [format, setFormat] = useState<Format>('image/jpeg')
  const [targetMode, setTargetMode] = useState(false)
  const [targetSizeKB, setTargetSizeKB] = useState('200')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [beforeAfter, setBeforeAfter] = useState<{ originalSize: number; compressedSize: number; originalUrl?: string; compressedUrl?: string } | null>(null)
  const [contentInfo, setContentInfo] = useState<ContentInfo | null>(null)
  const [pngWarn, setPngWarn] = useState(false)
  const [qualityWarning, setQualityWarning] = useState<string | null>(null)
  const worker = useImageWorker()

  const currentPreset = PRESETS.find((p) => p.id === presetId)

  const applyPreset = useCallback((p: CompPreset) => {
    setPresetId(p.id)
    setQuality(p.quality)
    if (p.format !== 'original') setFormat(p.format)
  }, [])

  const onFiles = useCallback(async (incoming: File[]) => {
    setFiles(incoming)
    setResult(null); releaseResultUrls()
    setBeforeAfter(null)
    setQualityWarning(null)
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
    setResult(null); releaseResultUrls()
    setBeforeAfter(null)
    setPngWarn(false)
    setQualityWarning(null)

    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const originalUrl = files.length === 1 ? URL.createObjectURL(files[0]) : undefined

    const effectiveFormat = format === 'original'
      ? (files[0]?.type === 'image/png' ? 'image/png' : files[0]?.type === 'image/webp' ? 'image/webp' : 'image/jpeg')
      : format

    if (format === 'image/jpeg' && files.some((f) => f.type === 'image/png')) setPngWarn(true)

    if (targetMode && targetSizeKB) {
      const minQ = contentInfo ? getMinQuality(contentInfo.type) : 5
      const res = await worker.run('compress-advanced', {
        files: payloads,
        opts: { format: effectiveFormat, targetSizeKB: parseInt(targetSizeKB, 10), quality, minQuality: minQ },
      })
      const items: ResultItem[] = res.map((r: any) => ({
        name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}Ã—${r.height} | q${r.quality}`,
      }))
      const before = files.reduce((s, f) => s + f.size, 0)
      const after = res.reduce((s: number, r: any) => s + r.size, 0)
      const savedPct = before > 0 ? Math.round((1 - after / before) * 100) : 0
      if (after > before * 0.95 && parseInt(targetSizeKB, 10) < before / 1024 * 0.5) {
        setQualityWarning(`Reaching ${targetSizeKB} KB may noticeably reduce image quality. Recommended target: ${Math.round(before / 2048)} KB.`)
      }
      setBeforeAfter({ originalSize: before, compressedSize: after, originalUrl, compressedUrl: items[0]?.url })
      setResult(items)
    } else {
      const res = await worker.run('compress-advanced', {
        files: payloads,
        opts: { format: effectiveFormat, quality, minQuality: contentInfo ? getMinQuality(contentInfo.type) : undefined },
      })
      const items: ResultItem[] = res.map((r: any) => ({
        name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}Ã—${r.height} | q${r.quality}`,
      }))
      const before = files.reduce((s, f) => s + f.size, 0)
      const after = res.reduce((s: number, r: any) => s + r.size, 0)
      setBeforeAfter({ originalSize: before, compressedSize: after, originalUrl, compressedUrl: items[0]?.url })
      setResult(items)
    }
  }, [files, format, quality, targetMode, targetSizeKB, worker, contentInfo])

  const reset = useCallback(() => {
    setFiles([]); setResult(null); releaseResultUrls(); setBeforeAfter(null); setContentInfo(null); setPngWarn(false)
    setTargetMode(false); setTargetSizeKB('200'); setPresetId('balanced'); setQuality(75); setFormat('image/jpeg')
    setQualityWarning(null)
  }, [])

  const savedPct = beforeAfter && beforeAfter.originalSize > 0
    ? Math.round((1 - beforeAfter.compressedSize / beforeAfter.originalSize) * 100)
    : 0

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => void onFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

          {/* Content type badge */}
          {contentInfo && (
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${contentInfo.badgeColor}`}>{contentInfo.badge}</span>
              {contentInfo.type === 'screenshot' && <span className="text-xs text-slate-400">Text-heavy images work best with PNG or high quality</span>}
              {contentInfo.type === 'graphic' && <span className="text-xs text-slate-400">Graphics may show artifacts at low quality</span>}
            </div>
          )}

          {/* Preset cards */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Compression Level</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`flex flex-col items-center rounded-xl border-2 px-3 py-3 text-center transition-all ${
                    presetId === p.id
                      ? 'border-brand-600 bg-brand-50 shadow-sm'
                      : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`mb-1 ${presetId === p.id ? 'text-brand-600' : 'text-slate-400'}`}>{p.icon}</span>
                  <span className={`text-sm font-medium ${presetId === p.id ? 'text-brand-700' : 'text-slate-700'}`}>{p.name}</span>
                  <span className="mt-0.5 text-[11px] text-slate-400">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom quality slider */}
          {(presetId === 'custom' || presetId === 'balanced') && format !== 'image/png' && (
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Quality Level</span>
                <span className="text-sm tabular-nums font-semibold text-brand-600">{quality}%</span>
              </div>
              <input
                type="range" min={1} max={100} value={quality}
                onChange={(e) => { setQuality(Number(e.target.value)); setPresetId('custom') }}
                className="w-full accent-brand-600"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>Smaller file</span>
                <span>Higher quality</span>
              </div>
            </div>
          )}

          {/* Target file size */}
          <div className="rounded-xl border border-slate-200 p-4">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={targetMode} onChange={(e) => setTargetMode(e.target.checked)} className="rounded text-brand-600" />
              <span className="font-medium">Target file size</span>
            </label>
            {targetMode && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
          </div>

          {/* Output format */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Output Format</h3>
            <div className="flex flex-wrap gap-2">
              {(['original', 'image/jpeg', 'image/webp', 'image/png'] as Format[]).map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    format === f ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}>
                  {f === 'original' ? 'Original' : f === 'image/jpeg' ? 'JPG' : f === 'image/webp' ? 'WebP' : 'PNG'}
                </button>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {qualityWarning && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-800">{qualityWarning}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setQualityWarning(null); setTargetMode(false) }}>Use recommended</Button>
                  <Button size="sm" variant="ghost" onClick={() => setQualityWarning(null)}>Continue anyway</Button>
                </div>
              </div>
            </div>
          )}
          {pngWarn && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              JPEG does not support transparency. Transparent areas will be filled with white. Consider WebP for better results.
            </div>
          )}

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0 || (targetMode && !targetSizeKB)} onClick={() => void run()}>
              Compress {files.length} image{files.length === 1 ? '' : 's'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Compressing...'} progress={worker.progress} onCancel={worker.cancel} />}

          {/* Before / After comparison */}
          {beforeAfter && beforeAfter.originalUrl && beforeAfter.compressedUrl && (
            <div className="space-y-4">
              <BeforeAfterSlider
                beforeUrl={beforeAfter.originalUrl}
                afterUrl={beforeAfter.compressedUrl}
                beforeLabel="Original"
                afterLabel="Compressed"
                beforeSize={formatBytes(beforeAfter.originalSize)}
                afterSize={formatBytes(beforeAfter.compressedSize)}
              />
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Original</p>
                  <p className="font-bold text-slate-700">{formatBytes(beforeAfter.originalSize)}</p>
                </div>
                <span className="text-2xl text-slate-300">â†’</span>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Compressed</p>
                  <p className="font-bold text-emerald-600">{formatBytes(beforeAfter.compressedSize)}</p>
                </div>
                <span className="text-2xl text-slate-300">|</span>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Saved</p>
                  <p className="font-bold text-emerald-600">{savedPct}%</p>
                </div>
              </div>
            </div>
          )}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
