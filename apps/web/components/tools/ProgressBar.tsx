'use client'

interface ProgressBarProps {
  /** 0-100, or null when idle */
  value: number | null
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  if (value === null) return null
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>{label ?? 'Processing…'}</span>
        <span className="tabular-nums font-medium">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
