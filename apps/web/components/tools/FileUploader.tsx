'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { validateFiles } from '@pdf-saas/file-utils'
import { ErrorAlert } from './ErrorAlert'

export interface FileUploaderProps {
  accept: string
  multiple?: boolean
  maxSizeMB?: number
  maxFiles?: number
  minFiles?: number
  hint?: string
  onFiles: (files: File[]) => void
}

export function FileUploader({
  accept,
  multiple = true,
  maxSizeMB,
  maxFiles,
  minFiles,
  hint,
  onFiles,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const files = Array.from(incoming)
      if (files.length === 0) return
      const result = validateFiles(files, { accept, maxSizeMB, minCount: minFiles, maxCount: maxFiles })
      if (!result.valid) {
        setError(result.errors.map((e) => e.reason).join(' '))
        return
      }
      setError(null)
      onFiles(files)
    },
    [accept, maxSizeMB, minFiles, maxFiles, onFiles],
  )

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/50'
        }`}
      >
        <UploadCloud className={`mb-3 h-10 w-10 ${dragging ? 'text-brand-500' : 'text-slate-400'}`} />
        <p className="text-sm font-medium text-slate-700">
          Drop {multiple ? 'files' : 'a file'} here, or <span className="text-brand-600">browse</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {hint ?? `Accepted: ${accept.split(',').map((a) => a.trim()).join(', ')}`}
          {maxSizeMB ? ` · Max ${maxSizeMB} MB` : ''}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}
    </div>
  )
}
