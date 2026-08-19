'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload } from '@/lib/client-utils'
import { formatBytes } from '@pdf-saas/file-utils'
import { ArrowRight, Info } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'

interface AnalysisResult {
  name: string; width: number; height: number; mime: string; size: number
  aspectRatio: number; megapixels: number; hasAlpha: boolean; format: string
  estimatedQuality: number; complexity: number; qualityLabel: string
}

interface ToolRecommendation { tool: string; slug: string; reason: string }

function getRecommendations(a: AnalysisResult): ToolRecommendation[] {
  const recs: ToolRecommendation[] = []
  if (a.size > 2_000_000) recs.push({ tool: 'Image Compressor', slug: 'image-compressor', reason: `${formatBytes(a.size)} is quite large. Compress to reduce file size for faster loading.` })
  if (a.megapixels > 8) recs.push({ tool: 'Image Resizer', slug: 'image-resizer', reason: `${a.width}x${a.height} (${a.megapixels.toFixed(1)}MP) is larger than most web and social platforms need.` })
  if (a.format === 'PNG' && a.size > 500_000 && !a.hasAlpha) recs.push({ tool: 'Image Converter', slug: 'image-converter', reason: 'This PNG does not use transparency. Converting to JPG can significantly reduce file size.' })
  if (a.complexity > 0.6 && a.size > 1_000_000) recs.push({ tool: 'Image Compressor', slug: 'image-compressor', reason: 'High-detail image with large file size. Advanced compression preserves detail while reducing size.' })
  if (a.width !== a.height && Math.abs(a.aspectRatio - 1) < 0.05) recs.push({ tool: 'Image Cropper', slug: 'image-cropper', reason: 'Almost square. Crop to perfect 1:1 for social media profiles and posts.' })
  if (a.width > 1080 && a.height > 1080) recs.push({ tool: 'Resize for Purpose', slug: 'image-resize-purpose', reason: 'Dimensions exceed most platform requirements. Resize for a specific use case.' })
  if (a.estimatedQuality < 50) recs.push({ tool: 'Image Quality Analyzer', slug: 'image-quality', reason: 'Low estimated quality. This image may have been compressed multiple times already.' })
  if (recs.length === 0) recs.push({ tool: 'Image Compressor', slug: 'image-compressor', reason: 'Image looks good. A light compression pass can still optimize it for web.' })
  return recs
}

export function ImageQualityAnalyzerTool() {
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<AnalysisResult[] | null>(null)
  const [recommendations, setRecommendations] = useState<ToolRecommendation[]>([])
  const worker = useImageWorker()

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null); setRecommendations([])
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const analyses = await worker.run('analyze', { files: payloads }) as unknown as AnalysisResult[]
    setResult(analyses)
    const allRecs: ToolRecommendation[] = []
    for (const a of analyses) {
      for (const r of getRecommendations(a)) {
        if (!allRecs.some((e) => e.slug === r.slug)) allRecs.push(r)
      }
    }
    setRecommendations(allRecs)
  }, [files, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); setRecommendations([]) }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={200} minFiles={1} onFiles={(incoming) => setFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />
          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>Quality estimates are approximate and based on file size relative to image dimensions. They provide a general indication — not a precise measurement.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              Analyze {files.length} Image{files.length === 1 ? '' : 's'}
            </Button>
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Analyzing...'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && result.map((a, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
              <h4 className="mb-3 text-sm font-semibold text-slate-800">{a.name}</h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <InfoRow label="Dimensions" value={`${a.width} x ${a.height}`} />
                <InfoRow label="Megapixels" value={`${a.megapixels.toFixed(2)} MP`} />
                <InfoRow label="File Size" value={formatBytes(a.size)} />
                <InfoRow label="Format" value={a.format} />
                <InfoRow label="Aspect Ratio" value={a.aspectRatio.toFixed(2)} />
                <InfoRow label="Bytes/Pixel" value={(a.size / (a.width * a.height || 1)).toFixed(2)} />
                <InfoRow label="Has Alpha" value={a.hasAlpha ? 'Yes' : 'No'} />
                <InfoRow label="Complexity" value={`${(a.complexity * 100).toFixed(0)}%`} />
                <InfoRow label="Est. Quality" value={<span className={a.estimatedQuality >= 85 ? 'text-emerald-600' : a.estimatedQuality >= 65 ? 'text-amber-600' : 'text-red-500'}>{a.qualityLabel} ({a.estimatedQuality}%)</span>} />
              </div>
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400"><span>Low Quality</span><span>High Quality</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${a.estimatedQuality >= 85 ? 'bg-emerald-500' : a.estimatedQuality >= 65 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${a.estimatedQuality}%` }} />
                </div>
              </div>
            </div>
          ))}

          {recommendations.length > 0 && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-5">
              <h4 className="mb-3 text-sm font-semibold text-brand-800">Suggested Next Steps</h4>
              <div className="space-y-2">
                {recommendations.map((rec, i) => (
                  <a key={i} href={`/pdf-saas/tools/${rec.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm transition-colors hover:border-brand-300">
                    <span className="font-medium text-brand-700">{rec.tool}</span>
                    <ArrowRight className="h-3 w-3 text-brand-400" />
                    <span className="text-slate-500">{rec.reason}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={reset}>Analyze More Images</Button>
        </div>
      )}
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs text-slate-400">{label}</p><p className="text-sm font-medium text-slate-700">{value}</p></div>
}
