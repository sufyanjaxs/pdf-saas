'use client'

import { useCallback, useState } from 'react'
import { FileUploader } from './FileUploader'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { useImageWorker } from '@/hooks/useImageWorker'
import { fileToImagePayload, resultBlobUrl } from '@/lib/client-utils'
import { Paintbrush } from 'lucide-react'

const ACCEPT = 'image/jpeg,image/png,image/webp'

const PRESETS = [
  { id: 'subtle', label: 'Subtle', amount: 25, desc: 'Gentle edge enhance' },
  { id: 'moderate', label: 'Moderate', amount: 50, desc: 'Standard sharpen' },
  { id: 'strong', label: 'Strong', amount: 75, desc: 'Heavy sharpen' },
  { id: 'custom', label: 'Custom', amount: 0, desc: 'Your choice' },
]

export function ImageSharpenTool() {
  const [files, setFiles] = useState<File[]>([])
  const [presetId, setPreset] = useState('moderate')
  const [amount, setAmount] = useState(50)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const worker = useImageWorker()

  const onFiles = useCallback((f: File[]) => { setFiles(f); setResult(null) }, [])

  const currentPreset = PRESETS.find((p) => p.id === presetId)!
  const effectiveAmount = presetId === 'custom' ? amount : currentPreset.amount

  const run = useCallback(async () => {
    if (files.length === 0) return
    setResult(null)
    const payloads = await Promise.all(files.map((f) => fileToImagePayload(f)))
    const res = await worker.run('sharpen', { files: payloads, opts: { amount: effectiveAmount } })
    const items: ResultItem[] = res.map((r: any) => ({
      name: r.name, url: resultBlobUrl(r.mime, r.bytes), size: r.size, detail: `${r.width}×${r.height}px | amount ${effectiveAmount}%`,
    }))
    setResult(items)
  }, [files, effectiveAmount, worker])

  const reset = useCallback(() => { setFiles([]); setResult(null); setPreset('moderate'); setAmount(50) }, [])

  if (files.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept={ACCEPT} multiple maxSizeMB={50} minFiles={1} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      wide
      preview={
        <div className="flex h-full flex-col items-center justify-center p-4">
          <div className="overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={URL.createObjectURL(files[0])} alt="Preview"
              className="max-h-[50vh] max-w-full rounded bg-white shadow-sm"
              style={{ filter: `contrast(1)`, transition: 'filter 0.2s ease' }} />
          </div>
          <p className="mt-3 text-sm text-slate-500">Amount: {effectiveAmount}%</p>
        </div>
      }
      controls={
        <>
          <ControlSection title="Sharpen Level">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => { setPreset(p.id); if (p.amount > 0) setAmount(p.amount) }}
                  className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                    presetId === p.id ? 'border-brand-600 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-brand-300'
                  }`}>
                  <span className={`block text-sm font-medium ${presetId === p.id ? 'text-brand-700' : 'text-slate-700'}`}>{p.label}</span>
                  <span className="block text-[10px] text-slate-400">{p.desc}</span>
                </button>
              ))}
            </div>
            {presetId === 'custom' && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500">Amount</label>
                  <span className="text-xs font-semibold text-brand-600">{amount}%</span>
                </div>
                <input type="range" min={1} max={100} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full" />
              </div>
            )}
          </ControlSection>
          {worker.error && <ErrorAlert message={worker.error} />}
          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={files.length === 0} onClick={() => void run()}>
              <Paintbrush className="mr-1 h-4 w-4" /> Apply Sharpen
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          {worker.running && <ProcessingOverlay label={worker.label || 'Sharpening...'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
