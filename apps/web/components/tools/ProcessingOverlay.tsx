'use client'

import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ProcessingOverlayProps {
  /** Active stage label, e.g. "Reading PDF…" or "Splitting page 3/12" */
  label: string
  /** 0-100; null = indeterminate */
  progress: number | null
  /** Optional cancel handler */
  onCancel?: () => void
}

/**
 * Full-bleed overlay rendered on top of a tool card while background work runs.
 * Mirrors ILovePDF's modal "processing" state: keeps the user's result input
 * visible behind a dimmed layer with a live spinner + percentage.
 */
export function ProcessingOverlay({ label, progress, onCancel }: ProcessingOverlayProps) {
  const pct = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress)))
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-lg ring-1 ring-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <div className="text-center">
          <p className="font-semibold text-slate-900">{label}</p>
          {pct !== null && <p className="text-xs text-slate-500">{pct}% complete</p>}
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
