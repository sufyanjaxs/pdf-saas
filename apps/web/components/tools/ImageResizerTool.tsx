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
import { Instagram, Youtube, Facebook, Twitter, Globe, Mail, FileText, User, Stamp } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp'

type PresetCategory = 'social' | 'web' | 'email' | 'document' | 'custom'

interface ResizePreset {
  id: string
  name: string
  category: PresetCategory
  width: number
  height: number
  icon: React.ReactNode
}

const PRESETS: ResizePreset[] = [
  { id: 'ig-square', name: 'Instagram Post', category: 'social', width: 1080, height: 1080, icon: <Instagram className="h-5 w-5" /> },
  { id: 'ig-story', name: 'Instagram Story', category: 'social', width: 1080, height: 1920, icon: <Instagram className="h-5 w-5" /> },
  { id: 'yt-thumb', name: 'YouTube Thumbnail', category: 'social', width: 1280, height: 720, icon: <Youtube className="h-5 w-5" /> },
  { id: 'fb-post', name: 'Facebook Post', category: 'social', width: 1200, height: 630, icon: <Facebook className="h-5 w-5" /> },
  { id: 'tw-post', name: 'Twitter/X Post', category: 'social', width: 1200, height: 675, icon: <Twitter className="h-5 w-5" /> },
  { id: 'tiktok', name: 'TikTok', category: 'social', width: 1080, height: 1920, icon: <Instagram className="h-5 w-5" /> },
  { id: 'pin', name: 'Pinterest Pin', category: 'social', width: 1000, height: 1500, icon: <Instagram className="h-5 w-5" /> },
  { id: 'web-hero', name: 'Website Hero', category: 'web', width: 1920, height: 1080, icon: <Globe className="h-5 w-5" /> },
  { id: 'web-banner', name: 'Website Banner', category: 'web', width: 1200, height: 400, icon: <Globe className="h-5 w-5" /> },
  { id: 'web-thumb', name: 'Web Thumbnail', category: 'web', width: 400, height: 300, icon: <Globe className="h-5 w-5" /> },
  { id: 'web-avatar', name: 'Profile Picture', category: 'web', width: 256, height: 256, icon: <User className="h-5 w-5" /> },
  { id: 'email-header', name: 'Email Header', category: 'email', width: 600, height: 200, icon: <Mail className="h-5 w-5" /> },
  { id: 'email-inline', name: 'Email Inline', category: 'email', width: 600, height: 400, icon: <Mail className="h-5 w-5" /> },
  { id: 'a4-portrait', name: 'A4 Portrait', category: 'document', width: 794, height: 1123, icon: <FileText className="h-5 w-5" /> },
  { id: 'passport', name: 'Passport Photo', category: 'document', width: 600, height: 600, icon: <Stamp className="h-5 w-5" /> },
]

const CATEGORY_LABELS: { id: PresetCategory; label: string }[] = [
  { id: 'social', label: 'Social Media' },
  { id: 'web', label: 'Website' },
  { id: 'email', label: 'Email' },
  { id: 'document', label: 'Document' },
  { id: 'custom', label: 'Custom' },
]

export function ImageResizerTool() {
  const [files, setFiles] = useState<File[]>([])
  const [category, setCategory] = useState<PresetCategory>('social')
  const [selectedPreset, setSelectedPreset] = useState('ig-square')
  const [customW, setCustomW] = useState('1920')
  const [customH, setCustomH] = useState('1080')
  const [keepRatio, setKeepRatio] = useState(true)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const filteredPresets = PRESETS.filter((p) => p.category === category)
  const currentPreset = filteredPresets.find((p) => p.id === selectedPreset)
  const outW = category === 'custom' ? parseInt(customW, 10) || 1920 : (currentPreset?.width ?? 1920)
  const outH = category === 'custom' ? parseInt(customH, 10) || 1080 : (currentPreset?.height ?? 1080)

  const run = useCallback(async () => {
    if (files.length === 0 || !outW || !outH) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('resize', {
      files: payloads,
      opts: { width: outW, height: keepRatio && category !== 'custom' ? undefined : outH, fit: keepRatio ? 'contain' : 'stretch' },
    })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}×${r.height} | ${currentPreset?.name ?? 'Custom'}`,
    }))
    setResult(items)
  }, [files, outW, outH, keepRatio, category, currentPreset, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null) }, [])

  return (
    <Card className="relative">
      {files.length === 0 ? (
        <FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={(incoming) => setFiles(incoming)} />
      ) : (
        <div className="space-y-6">
          <FileList files={files} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />

          {/* Category tabs */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Resize for</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_LABELS.map((c) => (
                <button key={c.id} type="button" onClick={() => { setCategory(c.id); const first = PRESETS.find((p) => p.category === c.id); if (first) setSelectedPreset(first.id) }}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                    category === c.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300'
                  }`}>{c.label}</button>
              ))}
            </div>
          </div>

          {/* Preset cards */}
          {category !== 'custom' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filteredPresets.map((p) => (
                <button key={p.id} type="button" onClick={() => setSelectedPreset(p.id)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-left transition-all ${
                    selectedPreset === p.id ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                  }`}>
                  <span className={selectedPreset === p.id ? 'text-brand-600' : 'text-slate-400'}>{p.icon}</span>
                  <div>
                    <span className={`block text-sm font-medium ${selectedPreset === p.id ? 'text-brand-700' : 'text-slate-700'}`}>{p.name}</span>
                    <span className="block text-xs text-slate-400">{p.width}×{p.height}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Custom dimensions */}
          {category === 'custom' && (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Width (px)</label>
                <input type="number" min={1} max={10000} value={customW} onChange={(e) => setCustomW(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Height (px)</label>
                <input type="number" min={1} max={10000} value={customH} onChange={(e) => setCustomH(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} className="rounded text-brand-600" />
                Keep ratio
              </label>
            </div>
          )}

          {/* Output preview */}
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex-1">
              <p className="text-xs text-slate-400">Output</p>
              <p className="text-lg font-bold text-slate-800">{outW} × {outH} <span className="text-sm font-normal text-slate-400">px</span></p>
            </div>
            {currentPreset && (
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">{currentPreset.name}</span>
            )}
          </div>

          {worker.error && <ErrorAlert message={worker.error} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              Resize {files.length} Image{files.length === 1 ? '' : 's'}
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Resizing images...'} progress={worker.progress} onCancel={worker.cancel} />}

          {result && <ResultPanel items={result} onReset={reset} />}
        </div>
      )}
    </Card>
  )
}
