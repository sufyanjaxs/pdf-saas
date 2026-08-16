'use client'

import { X, ChevronUp, ChevronDown, FileText, Image } from 'lucide-react'
import { formatBytes, mimeFromExtension } from '@pdf-saas/file-utils'

export interface FileListItemProps {
  files: File[]
  reorderable?: boolean
  onRemove?: (index: number) => void
  onMove?: (index: number, dir: -1 | 1) => void
  onSelectFile?: (file: File) => void
}

export function FileList({ files, reorderable, onRemove, onMove, onSelectFile }: FileListItemProps) {
  if (files.length === 0) return null

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
      {files.map((file, i) => {
        const isPdf = file.type === 'application/pdf' || mimeFromExtension(file.name) === 'application/pdf'
        return (
          <li key={`${file.name}-${file.lastModified}`} className="flex items-center gap-3 bg-white px-4 py-3">
            {isPdf ? (
              <FileText className="h-5 w-5 shrink-0 text-red-500" />
            ) : (
              <Image className="h-5 w-5 shrink-0 text-brand-500" />
            )}
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700 hover:text-brand-600"
              onClick={() => onSelectFile?.(file)}
              title={file.name}
            >
              {file.name}
            </button>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">{formatBytes(file.size)}</span>
            {reorderable && onMove && (
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onMove(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, 1)}
                  disabled={i === files.length - 1}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
