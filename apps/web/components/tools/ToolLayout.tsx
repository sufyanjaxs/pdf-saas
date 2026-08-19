'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ToolDefinition } from '@/lib/tools/definitions'

export function ToolLayout({
  tool,
  children,
}: {
  tool: ToolDefinition
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" />
        All tools
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-600">{tool.category} tool</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">{tool.name}</h1>
            <p className="mt-2 max-w-xl text-slate-600">{tool.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              100% local — files never leave your device
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <Zap className="h-3.5 w-3.5" />
              Processed in your browser
            </span>
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}
