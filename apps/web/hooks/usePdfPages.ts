'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { renderThumbnails, type RenderedPage } from '@/lib/pdfjs'

export interface PdfPagesState {
  pages: RenderedPage[]
  pageCount: number
  loading: boolean
  error: string | null
}

/**
 * Loads a PDF once and renders thumbnails for every page.
 * Used by page-selection tools (split, delete, rotate, extract, pdf→jpg).
 */
export function usePdfPages() {
  const [state, setState] = useState<PdfPagesState>({
    pages: [],
    pageCount: 0,
    loading: false,
    error: null,
  })
  const runIdRef = useRef(0)

  const load = useCallback(async (file: File) => {
    const runId = ++runIdRef.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const bytes = await file.arrayBuffer()
      const pages = await renderThumbnails(bytes, 160)
      if (runId !== runIdRef.current) return
      setState({ pages, pageCount: pages.length, loading: false, error: null })
    } catch (err) {
      if (runId !== runIdRef.current) return
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to read PDF',
      }))
    }
  }, [])

  useEffect(() => () => {
    runIdRef.current++
  }, [])

  return { ...state, load }
}
