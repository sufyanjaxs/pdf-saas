'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { ArrowRight, Check, Shield, Globe, Users, FileText, Mail, Smartphone } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'
type Purpose = 'web' | 'social' | 'print' | 'email' | 'presentation' | 'documentation'

interface PurposeConfig {
  id: Purpose; label: string; icon: React.ReactNode; description: string
  options: { id: string; name: string; desc: string; width: number; height: number; maxHeight?: number }[]
  maxSizeMB?: number
  fitOptions: { id: string; label: string }[]
}

const PURPOSES: PurposeConfig[] = [
  {
    id: 'web', label: 'Website', icon: <Globe className="h-4 w-4" />, description: 'Fast-loading images for websites and blogs',
    options: [
      { id: 'hero', name: 'Hero Banner', desc: 'Full-width header', width: 1920, height: 1080, maxHeight: 400 },
      { id: 'thumbnail', name: 'Thumbnail', desc: 'Small preview image', width: 400, height: 300 },
      { id: 'blog-inline', name: 'Blog Inline', desc: 'In-article image', width: 800, height: 500 },
      { id: 'avatar', name: 'Profile Picture', desc: 'Circular profile image', width: 256, height: 256 },
      { id: 'og-image', name: 'OG Image', desc: 'Social share preview', width: 1200, height: 630 },
    ], fitOptions: [{ id: 'contain', label: 'Fit (full visible)' }, { id: 'cover', label: 'Fill (crop to fit)' }, { id: 'stretch', label: 'Stretch' }],
  },
  {
    id: 'social', label: 'Social Media', icon: <Users className="h-4 w-4" />, description: 'Optimized for social platforms',
    options: [
      { id: 'ig-post', name: 'Instagram Post', desc: 'Square post', width: 1080, height: 1080 },
      { id: 'ig-story', name: 'Instagram Story', desc: 'Vertical story', width: 1080, height: 1920 },
      { id: 'fb-post', name: 'Facebook Post', desc: 'Timeline post', width: 1200, height: 630 },
      { id: 'tw-post', name: 'Twitter/X Post', desc: 'Timeline tweet', width: 1200, height: 675 },
      { id: 'yt-thumb', name: 'YouTube Thumbnail', desc: 'Video preview', width: 1280, height: 720 },
      { id: 'tiktok', name: 'TikTok', desc: 'Vertical video', width: 1080, height: 1920 },
    ], fitOptions: [{ id: 'contain', label: 'Fit (full visible)' }, { id: 'cover', label: 'Fill (crop to fit)' }],
  },
  {
    id: 'print', label: 'Print / High-Res', icon: <Shield className="h-4 w-4" />, description: 'High-resolution for print and professional use',
    options: [
      { id: 'a4-landscape', name: 'A4 Landscape', desc: '300 DPI landscape', width: 3508, height: 2480 },
      { id: 'a4-portrait', name: 'A4 Portrait', desc: '300 DPI portrait', width: 2480, height: 3508 },
      { id: 'photo-4x6', name: '4×6 Photo', desc: 'Standard photo print', width: 1800, height: 1200 },
      { id: 'poster-a3', name: 'Poster A3', desc: 'Large format', width: 4961, height: 3508 },
    ], fitOptions: [{ id: 'contain', label: 'Fit' }, { id: 'cover', label: 'Fill (crop to fit)' }],
  },
  {
    id: 'email', label: 'Email', icon: <Mail className="h-4 w-4" />, description: 'Small, fast-loading for email clients',
    options: [
      { id: 'email-header', name: 'Email Header', desc: 'Banner image', width: 600, height: 200 },
      { id: 'email-inline', name: 'Email Inline', desc: 'Content image', width: 600, height: 400 },
      { id: 'email-thumb', name: 'Email Thumbnail', desc: 'Small preview', width: 150, height: 150 },
    ], maxSizeMB: 0.5, fitOptions: [{ id: 'contain', label: 'Fit' }, { id: 'cover', label: 'Fill' }],
  },
  {
    id: 'presentation', label: 'Slides / PPT', icon: <FileText className="h-4 w-4" />, description: 'PowerPoint, Keynote, Google Slides',
    options: [
      { id: 'widescreen', name: 'Widescreen 16:9', desc: 'Standard slides', width: 1920, height: 1080 },
      { id: 'standard', name: 'Standard 4:3', desc: 'Older format', width: 1024, height: 768 },
      { id: 'ultra', name: 'Ultra HD 16:9', desc: '4K presentation', width: 3840, height: 2160 },
    ], fitOptions: [{ id: 'contain', label: 'Fit (full visible)' }, { id: 'cover', label: 'Fill (crop to fit)' }],
  },
  {
    id: 'documentation', label: 'Documentation', icon: <FileText className="h-4 w-4" />, description: 'Technical docs, README, wikis',
    options: [
      { id: 'readme', name: 'README Image', desc: 'GitHub/docs', width: 1280, height: 720 },
      { id: 'diagram', name: 'Diagram', desc: 'Technical diagram', width: 1920, height: 1080 },
      { id: 'screenshot', name: 'Screenshot', desc: 'Full screen capture', width: 1920, height: 1080 },
    ], fitOptions: [{ id: 'contain', label: 'Fit' }, { id: 'cover', label: 'Fill' }],
  },
]

export function ResizeForPurposeTool() {
  const [files, setFiles] = useState<File[]>([])
  const [purposeId, setPurposeId] = useState<Purpose>('web')
  const [selectedOptionId, setSelectedOptionId] = useState('hero')
  const [fit, setFit] = useState('contain')
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const purpose = PURPOSES.find((p) => p.id === purposeId)!
  const option = purpose.options.find((o) => o.id === selectedOptionId) ?? purpose.options[0]
  const fitOptions = purpose.fitOptions

  const run = useCallback(async () => {
    if (files.length === 0 || !option) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('resize', {
      files: payloads, opts: { width: option.width, height: option.height, fit }
    })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size,
      detail: `${r.width}×${r.height}px | ${purpose.label}: ${option.name}`
    }))
    setResult(items)
  }, [files, option, fit, purpose, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null) }, [])

  return (
    <Card className="relative">
      {!result ? (
        <>
          {files.length === 0 ? (
            <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => setFiles(incoming)} />
          ) : (
            <div className="space-y-6">
              <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

              {/* Purpose tabs */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Resize for</h3>
                <div className="flex flex-wrap gap-2">
                  {PURPOSES.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setPurposeId(p.id); setSelectedOptionId(p.options[0].id) }}
                      className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                        purposeId === p.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                      }`}>{p.icon}{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Option cards */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {purpose.options.map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setSelectedOptionId(opt.id)}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      selectedOptionId === opt.id ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                    }`}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                      selectedOptionId === opt.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>{opt.width < 1000 ? opt.width : `${(opt.width / 1000).toFixed(1)}k`}</span>
                    <div>
                      <span className={`block text-sm font-medium ${selectedOptionId === opt.id ? 'text-brand-700' : 'text-slate-700'}`}>{opt.name}</span>
                      <span className="block text-xs text-slate-400">{opt.desc} • {opt.width}×{opt.height}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Fit */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Fit Mode</h3>
                <div className="flex flex-wrap gap-2">
                  {fitOptions.map((fo) => (
                    <button key={fo.id} type="button" onClick={() => setFit(fo.id)}
                      className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                        fit === fo.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                      }`}>{fo.label}</button>
                  ))}
                </div>
              </div>

              {/* Output summary */}
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Output</p>
                  <p className="text-lg font-bold text-slate-800">{option.width} × {option.height} <span className="text-sm font-normal text-slate-400">px</span></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{purpose.label}</p>
                  <p className="text-sm font-medium text-slate-700">{option.name}</p>
                </div>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">{fit}</span>
              </div>

              {purpose.maxSizeMB && (
                <p className="text-xs text-amber-600">
                  <Shield className="mr-1 inline h-3 w-3" /> Max recommended file size: {purpose.maxSizeMB} MB for email
                </p>
              )}

              {worker.error && <ErrorAlert message={worker.error} />}

              <div className="flex items-center gap-3">
                <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
                  <ArrowRight className="mr-1 h-4 w-4" /> Resize for {purpose.label}
                </Button>
                {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
              </div>
              {worker.running && <ProcessingOverlay label={worker.label || 'Resizing...'} progress={worker.progress} onCancel={worker.cancel} />}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <ResultPanel items={result} onReset={reset} />
        </div>
      )}
    </Card>
  )
}
