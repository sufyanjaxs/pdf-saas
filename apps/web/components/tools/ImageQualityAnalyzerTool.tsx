'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { ArrowLeft, Camera, Star, FileText, Gauge, Layers, Image as ImageIcon, Download } from 'lucide-react'
import Link from 'next/link'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'
type ToolTab = 'upload' | 'results'

const TOOL_SLUGS = [
  { slug: 'image-resize', label: 'Resize', icon: '↔️', desc: 'Change image dimensions' },
  { slug: 'image-compress', label: 'Compress', icon: '📦', desc: 'Reduce file size' },
  { slug: 'image-crop', label: 'Crop', icon: '✂️', desc: 'Crop to focus area' },
  { slug: 'image-converter', label: 'Convert Format', icon: '🔄', desc: 'Convert to JPG/PNG/WebP' },
]

interface AnalysisData {
  verdict: string
  score: number
  fileSize: number
  mimeType: string
  imgWidth: number
  imgHeight: number
  megapixels: number
  aspectRatio: number
  format: string
  qualityIssues: string[]
  recommendations: { title: string; description: string; tool: string; action: string }[]
}

function getVerdict(score: number): string {
  if (score >= 90) return 'Excellent quality'
  if (score >= 75) return 'Good quality'
  if (score >= 50) return 'Average quality — improvements possible'
  if (score >= 30) return 'Below average — room for improvement'
  return 'Poor quality — significant issues detected'
}

function getColor(score: number): string {
  if (score >= 90) return 'text-emerald-600'
  if (score >= 75) return 'text-blue-600'
  if (score >= 50) return 'text-amber-600'
  if (score >= 30) return 'text-orange-600'
  return 'text-red-600'
}

function getBgColor(score: number): string {
  if (score >= 90) return 'from-emerald-50 to-teal-50'
  if (score >= 75) return 'from-blue-50 to-cyan-50'
  if (score >= 50) return 'from-amber-50 to-yellow-50'
  if (score >= 30) return 'from-orange-50 to-red-50'
  return 'from-red-50 to-rose-50'
}

function analyzeFile(file: File, dims: { width: number; height: number }): AnalysisData {
  const megapixels = (dims.width * dims.height) / 1_000_000
  const aspectRatio = dims.width / dims.height
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'unknown'
  const format = ext === 'jpg' ? 'JPEG' : ext === 'jpeg' ? 'JPEG' : ext.toUpperCase()

  let score = 80
  const qualityIssues: string[] = []
  const recommendations: { title: string; description: string; tool: string; action: string }[] = []

  if (megapixels >= 12) { score += 15; score = Math.min(score, 100) } else if (megapixels >= 5) { score += 8; score = Math.min(score, 100) }
  else if (megapixels < 0.3) { score -= 25; qualityIssues.push('Very low resolution — fewer than 0.3 megapixels') }
  else if (megapixels < 1) { score -= 10; qualityIssues.push('Low resolution — under 1 megapixel') }

  const shortSide = Math.min(dims.width, dims.height)
  if (dims.width > 8000 || dims.height > 8000) { score -= 10; qualityIssues.push('Unusually large dimensions — potential overkill for most uses') }
  if (shortSide < 200 && file.size > 500_000) { score -= 15; qualityIssues.push('Small image with unusually high file size — possible poor compression') }

  const bytesPerPixel = file.size / (dims.width * dims.height)
  const bppKB = bytesPerPixel * 1024
  if (ext === 'jpg' || ext === 'jpeg') {
    if (bppKB < 0.03) { score -= 15; qualityIssues.push('Heavily compressed JPEG — likely visible compression artifacts') }
    else if (bppKB < 0.06) { score -= 5; qualityIssues.push('Light JPEG compression detected') }
  }
  if (ext === 'png' && file.size > 10_000_000) { qualityIssues.push('Very large PNG — may benefit from conversion or recompression') }

  const mins = [800, 1200, 1920, 3840]
  const idealPx = mins.filter((m) => dims.width >= m || dims.height >= m).pop() ?? mins[0]

  if (dims.width > 4000 || dims.height > 4000) {
    score -= 5
    qualityIssues.push('Over 4000px — may be too large for web or social media')
    recommendations.push({ title: 'Resize for sharing', description: `Reduce from ${dims.width}×${dims.height} to a web-friendly ${idealPx}px on the long side.`, tool: 'image-resize', action: `Resize to ${idealPx}px` })
  }

  if (file.size > 5_000_000 && (ext === 'jpg' || ext === 'jpeg' || ext === 'png')) {
    score -= 10
    qualityIssues.push('Large file size — may be slow to load or upload')
    recommendations.push({ title: 'Compress to save space', description: 'Reduce file size while keeping visual quality high.', tool: 'image-compress', action: 'Compress this image' })
  }

  const raw = megapixels * 0.5
  const overall = raw + score * 0.5
  const finalScore = Math.max(0, Math.min(100, Math.round(overall)))

  if (ext === 'png' && !qualityIssues.some((i) => i.includes('PNG'))) {
    recommendations.push({ title: 'Convert to JPG', description: 'If no transparency needed, JPG can dramatically reduce size.', tool: 'image-converter', action: 'Convert to JPG' })
  }
  if (recommendations.length === 0) {
    recommendations.push({ title: 'Resize for web', description: `Resize to ${idealPx}px for fast loading.`, tool: 'image-resize', action: `Resize to ${idealPx}px` })
  }

  return {
    verdict: getVerdict(finalScore), score: finalScore, fileSize: file.size, mimeType: file.type,
    imgWidth: dims.width, imgHeight: dims.height, megapixels, aspectRatio, format, qualityIssues, recommendations,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImageQualityAnalyzerTool() {
  const [tab, setTab] = useState<ToolTab>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const onFiles = useCallback(async (incoming: File[]) => {
    const file = incoming[0]; if (!file) return
    setFiles(incoming); setResult(null)
    await fileToImagePayload(file)
    const dims = await new Promise<{ width: number; height: number }>((r) => {
      const img = new Image(); img.onload = () => { r({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src) }
      img.src = URL.createObjectURL(file)
    })
    setAnalysis(analyzeFile(file, dims)); setPreviewUrl(URL.createObjectURL(file)); setTab('results')
  }, [])

  const reset = useCallback(() => { setFiles([]); setAnalysis(null); setResult(null); setPreviewUrl(null); setTab('upload') }, [])

  return (
    <Card className="relative">
      {tab === 'upload' ? (
        <FileUploader accept={ACCEPT} maxSizeMB={50} multiple={false} onFiles={(incoming) => void onFiles(incoming)}
          hint="Upload a JPG, PNG, WebP, GIF, or BMP image to analyze" />
      ) : analysis && (
        <div className="space-y-6">
          <button type="button" onClick={reset} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Analyze another image
          </button>

          {files[0] && <FileList files={[files[0]]} onRemove={reset} />}

          <div className={`rounded-xl bg-gradient-to-br p-5 text-center ${getBgColor(analysis.score)}`}>
            <Camera className={`mx-auto mb-2 h-6 w-6 ${getColor(analysis.score)}`} />
            <p className={`text-3xl font-black ${getColor(analysis.score)}`}>{analysis.score}/100</p>
            <p className="text-sm text-slate-600 mt-1">{analysis.verdict}</p>
          </div>

          {previewUrl && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Analyzed image" className="max-h-[300px] rounded-xl border border-slate-200 shadow-sm" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <Gauge className="h-4 w-4" />, label: 'File Size', value: formatBytes(analysis.fileSize) },
              { icon: <ImageIcon className="h-4 w-4" />, label: 'Dimensions', value: `${analysis.imgWidth}×${analysis.imgHeight}` },
              { icon: <Layers className="h-4 w-4" />, label: 'Megapixels', value: analysis.megapixels.toFixed(2) },
              { icon: <FileText className="h-4 w-4" />, label: 'Format', value: analysis.format },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <span className="mx-auto mb-1 block text-slate-400">{s.icon}</span>
                <span className="block text-sm font-bold text-slate-700">{s.value}</span>
                <span className="block text-[10px] text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>

          {analysis.qualityIssues.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="mb-2 text-xs font-semibold text-amber-800">Quality Issues</p>
              <ul className="space-y-1.5">
                {analysis.qualityIssues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                    <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />{issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.recommendations.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Recommended Tools</h3>
              <div className="space-y-2">
                {analysis.recommendations.map((rec, i) => (
                  <Link key={i} href={`/tools/${rec.tool}?ref=image-quality&action=${rec.action}`}
                    className="block rounded-xl border border-slate-200 p-3 text-left transition-all hover:border-brand-300 hover:bg-brand-50 hover:shadow-sm">
                    <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
                    <p className="text-xs text-slate-500">{rec.description}</p>
                    <span className="mt-1 inline-block text-xs font-semibold text-brand-600">{rec.action} →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {result && <ResultPanel items={result} onReset={reset} />}
          {worker.error && <ErrorAlert message={worker.error} />}

          <Button onClick={reset} variant="outline" className="w-full">Analyze Another Image</Button>
        </div>
      )}
    </Card>
  )
}
