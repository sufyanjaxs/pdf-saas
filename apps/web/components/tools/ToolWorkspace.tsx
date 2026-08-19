'use client'

import { type ReactNode, useState, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface ToolWorkspaceProps {
  preview: ReactNode
  controls: ReactNode
  actions?: ReactNode
  /** Use wide layout for tools that need more preview space */
  wide?: boolean
  /** Optional summary bar shown above controls on mobile */
  summary?: ReactNode
}

export function ToolWorkspace({ preview, controls, actions, wide, summary }: ToolWorkspaceProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className={wide ? 'tool-workspace-wide' : 'tool-workspace'}>
      <div className="space-y-4">
        <div className="tool-preview-area">
          {preview}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-3">
            {actions}
          </div>
        )}
      </div>

      {/* Desktop controls */}
      <div className="tool-controls-panel hidden lg:block">
        {summary}
        {controls}
      </div>

      {/* Mobile bottom sheet */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 shadow-sm"
        >
          {mobileOpen ? 'Hide' : 'Show'} Options
          {mobileOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {mobileOpen && (
          <div className="mt-2 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {summary}
            {controls}
          </div>
        )}
      </div>
    </div>
  )
}

export function ControlSection({
  title,
  children,
  className = '',
  collapsed = false,
}: {
  title: string
  children: ReactNode
  className?: string
  collapsed?: boolean
}) {
  const [isOpen, setIsOpen] = useState(!collapsed)

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between"
      >
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {collapsed && (
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function OptionButton({
  selected,
  onClick,
  children,
  className = '',
  disabled = false,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        selected
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-slate-200 text-slate-600 hover:border-brand-300'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function InfoBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
      {children}
    </div>
  )
}

export function StatBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`font-semibold ${accent ? 'text-emerald-600' : 'text-slate-700'}`}>{value}</p>
    </div>
  )
}

export function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; icon?: ReactNode }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
            value === o.id
              ? 'border-brand-600 bg-brand-50 text-brand-700'
              : 'border-slate-200 text-slate-600 hover:border-brand-300'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function DimensionInputs({
  width,
  height,
  onWidthChange,
  onHeightChange,
  lockRatio,
  onLockToggle,
  maxWidth = 10000,
  maxHeight = 10000,
}: {
  width: string
  height: string
  onWidthChange: (v: string) => void
  onHeightChange: (v: string) => void
  lockRatio: boolean
  onLockToggle: () => void
  maxWidth?: number
  maxHeight?: number
}) {
  return (
    <div className="flex items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Width</label>
        <input
          type="number"
          min={1}
          max={maxWidth}
          value={width}
          onChange={(e) => onWidthChange(e.target.value)}
          className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
      </div>
      <button
        type="button"
        onClick={onLockToggle}
        className={`mb-0.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
          lockRatio
            ? 'border-brand-600 bg-brand-50 text-brand-700'
            : 'border-slate-200 text-slate-500 hover:border-brand-300'
        }`}
        title={lockRatio ? 'Unlock ratio' : 'Lock ratio'}
      >
        {lockRatio ? '🔗' : '🔗‍'}
      </button>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Height</label>
        <input
          type="number"
          min={1}
          max={maxHeight}
          value={height}
          onChange={(e) => onHeightChange(e.target.value)}
          className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
      </div>
    </div>
  )
}
