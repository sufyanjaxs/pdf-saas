'use client'

export interface PresetOption {
  id: string
  label: string
  sublabel?: string
  icon?: React.ReactNode
}

export interface PresetSelectorProps {
  presets: PresetOption[]
  selected: string
  onSelect: (id: string) => void
  columns?: 2 | 3 | 4 | 5 | 6
  className?: string
}

export function PresetSelector({
  presets,
  selected,
  onSelect,
  columns = 3,
  className = '',
}: PresetSelectorProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-3 sm:grid-cols-5',
    6: 'grid-cols-3 sm:grid-cols-6',
  }

  return (
    <div className={`grid gap-2 ${gridCols[columns]} ${className}`}>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onSelect(preset.id)}
          className={`flex flex-col items-center rounded-xl border-2 px-3 py-3 text-center transition-all ${
            selected === preset.id
              ? 'border-brand-600 bg-brand-50 shadow-sm'
              : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
          }`}
        >
          {preset.icon && (
            <span className={`mb-1 ${selected === preset.id ? 'text-brand-600' : 'text-slate-400'}`}>
              {preset.icon}
            </span>
          )}
          <span className={`text-sm font-medium ${selected === preset.id ? 'text-brand-700' : 'text-slate-700'}`}>
            {preset.label}
          </span>
          {preset.sublabel && (
            <span className="mt-0.5 text-[11px] text-slate-400">{preset.sublabel}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export interface DimensionInputsProps {
  width: string
  height: string
  lockRatio: boolean
  onWidthChange: (w: string) => void
  onHeightChange: (h: string) => void
  onLockRatioChange: (locked: boolean) => void
  maxWidth?: number
  maxHeight?: number
  disabled?: boolean
  className?: string
}

export function DimensionInputs({
  width,
  height,
  lockRatio,
  onWidthChange,
  onHeightChange,
  onLockRatioChange,
  maxWidth = 10000,
  maxHeight = 10000,
  disabled = false,
  className = '',
}: DimensionInputsProps) {
  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Width (px)</label>
        <input
          type="number"
          min={1}
          max={maxWidth}
          value={width}
          onChange={(e) => onWidthChange(e.target.value)}
          disabled={disabled}
          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>
      <span className="pb-2 text-slate-400">×</span>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Height (px)</label>
        <input
          type="number"
          min={1}
          max={maxHeight}
          value={height}
          onChange={(e) => onHeightChange(e.target.value)}
          disabled={disabled}
          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={lockRatio}
          onChange={(e) => onLockRatioChange(e.target.checked)}
          className="rounded text-brand-600"
        />
        Lock ratio
      </label>
    </div>
  )
}

export interface FileInfoBarProps {
  originalWidth?: number
  originalHeight?: number
  originalSize?: number
  outputWidth?: number
  outputHeight?: number
  outputSize?: number
  format?: string
  className?: string
}

export function FileInfoBar({
  originalWidth,
  originalHeight,
  originalSize,
  outputWidth,
  outputHeight,
  outputSize,
  format,
  className = '',
}: FileInfoBarProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  if (!originalWidth && !originalSize) return null

  return (
    <div className={`flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 px-4 py-2.5 text-sm ${className}`}>
      {originalWidth && originalHeight && (
        <span className="text-slate-600">
          Original: <span className="font-medium">{originalWidth} × {originalHeight}</span>
        </span>
      )}
      {originalSize && (
        <span className="text-slate-600">
          Size: <span className="font-medium">{formatBytes(originalSize)}</span>
        </span>
      )}
      {format && (
        <span className="text-slate-600">
          Format: <span className="font-medium uppercase">{format}</span>
        </span>
      )}
      {outputWidth && outputHeight && (
        <>
          <span className="text-slate-300">→</span>
          <span className="text-emerald-600">
            Output: <span className="font-medium">{outputWidth} × {outputHeight}</span>
          </span>
        </>
      )}
      {outputSize && (
        <span className="text-emerald-600">
          Size: <span className="font-medium">{formatBytes(outputSize)}</span>
        </span>
      )}
    </div>
  )
}

export interface TransparencyCheckerboardProps {
  className?: string
  children?: React.ReactNode
}

export function TransparencyCheckerboard({ className = '', children }: TransparencyCheckerboardProps) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)',
        backgroundSize: '16px 16px',
      }}
    >
      {children}
    </div>
  )
}

export interface StarRatingProps {
  rating: number
  maxStars?: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function StarRating({ rating, maxStars = 5, size = 'md', label }: StarRatingProps) {
  const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' }
  const filled = Math.round((rating / 100) * maxStars)

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: maxStars }).map((_, i) => (
          <svg
            key={i}
            className={`${sizes[size]} ${i < filled ? 'text-amber-400' : 'text-slate-200'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      {label && <span className="text-sm font-medium text-slate-600">{label}</span>}
    </div>
  )
}
