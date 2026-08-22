'use client'

import { useCallback, useMemo, useState } from 'react'
import { FileUploader } from './FileUploader'
import { FileList } from './FileList'
import { ProgressBar } from './ProgressBar'
import { ProcessingOverlay } from './ProcessingOverlay'
import { ResultPanel, type ResultItem } from './ResultPanel'
import { ErrorAlert } from './ErrorAlert'
import { Button } from '@/components/ui/button'
import { ToolWorkspace, ControlSection } from './ToolWorkspace'
import { usePdfWorker } from '@/hooks/usePdfWorker'
import { defaultOutputName, resultBlobUrl, releaseResultUrls } from '@/lib/client-utils'
import { Shield, Eye, EyeOff, Lock, CheckCircle2, XCircle } from 'lucide-react'

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'bg-slate-200' }
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score <= 2) return { score, label: 'Fair', color: 'bg-orange-500' }
  if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-500' }
  if (score <= 4) return { score, label: 'Strong', color: 'bg-emerald-500' }
  return { score, label: 'Very Strong', color: 'bg-emerald-600' }
}

export function PdfProtectTool() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [result, setResult] = useState<ResultItem[] | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const worker = usePdfWorker()

  const strength = useMemo(() => getPasswordStrength(password), [password])
  const pwMatch = confirm.length > 0 && password === confirm
  const pwMismatch = confirm.length > 0 && password !== confirm

  const onFiles = useCallback((files: File[]) => {
    setFile(files[0])
    setResult(null); releaseResultUrls()
    setLocalError(null)
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    if (password.length < 4) {
      setLocalError('Password must be at least 4 characters.')
      return
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    setLocalError(null)
    const bytes = await file.arrayBuffer()
    const res = await worker.run('protect', { bytes: new Uint8Array(bytes), password })
    setResult([
      {
        name: defaultOutputName(file.name, 'protected', 'application/pdf'),
        url: resultBlobUrl('application/pdf', res.bytes),
        size: res.bytes.byteLength,
      },
    ])
  }, [file, password, confirm, worker])

  const reset = useCallback(() => {
    setFile(null)
    setPassword('')
    setConfirm('')
    setResult(null); releaseResultUrls()
    setLocalError(null)
  }, [])

  if (!file) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><FileUploader accept="application/pdf" maxSizeMB={200} multiple={false} onFiles={onFiles} /></div>
  }
  if (result) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><ResultPanel items={result} onReset={reset} /></div>
  }

  return (
    <ToolWorkspace
      preview={
        <div className="flex h-full flex-col items-center justify-center p-8">
          <div className="relative mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg">
              <Shield className="h-12 w-12 text-white" />
            </div>
            {password.length >= 4 && (
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
                <Lock className="h-4 w-4 text-brand-600" />
              </div>
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Password Protection</h3>
          <p className="mt-1 max-w-xs text-center text-sm text-slate-500">
            Choose a strong password to encrypt your PDF
          </p>
        </div>
      }
      controls={
        <>
          <FileList files={[file]} onRemove={reset} />

          <ControlSection title="Password">
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 4 chars)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {password.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Strength</span>
                    <span className={`text-xs font-medium ${strength.score <= 2 ? 'text-red-600' : strength.score <= 3 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-slate-200'}`} />
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm focus:outline-none ${
                    pwMismatch ? 'border-red-400 focus:border-red-500' : pwMatch ? 'border-emerald-400 focus:border-emerald-500' : 'border-slate-300 focus:border-brand-500'
                  }`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {pwMatch && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {pwMismatch && <XCircle className="h-4 w-4 text-red-500" />}
                </div>
              </div>
              {pwMismatch && <p className="text-xs text-red-500">Passwords do not match</p>}
            </div>
          </ControlSection>

          {(localError || worker.error) && <ErrorAlert message={localError || worker.error || ''} />}

          <div className="flex items-center gap-3">
            <Button size="lg" loading={worker.running} disabled={password.length < 4 || !!pwMismatch} onClick={() => void run()}>
              <Lock className="mr-1 h-4 w-4" /> Protect PDF
            </Button>
            {worker.running && <Button variant="ghost" onClick={worker.cancel}>Cancel</Button>}
          </div>
          <ProgressBar value={worker.progress} label={worker.label} />
          {worker.running && <ProcessingOverlay label={worker.label || 'Protecting PDFâ€¦'} progress={worker.progress} onCancel={worker.cancel} />}
        </>
      }
    />
  )
}
