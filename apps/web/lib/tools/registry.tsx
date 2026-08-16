'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { toolDefinitions } from './definitions'

export interface RegistryEntry {
  slug: string
  component: ComponentType
}

function lazy(loader: () => Promise<{ default: ComponentType }>): ComponentType {
  return dynamic(loader, { ssr: false, loading: () => <ToolSkeleton /> })
}

function ToolSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-1/3 rounded bg-slate-200" />
      <div className="h-40 rounded-xl bg-slate-200" />
      <div className="h-8 w-2/3 rounded bg-slate-200" />
    </div>
  )
}

/**
 * Map every tool slug to its lazily-loaded component.
 * Dynamic imports keep the initial bundle tiny — PDF/image engines only load
 * when a tool is actually opened.
 */
const loaders: Record<string, () => Promise<{ default: ComponentType }>> = {
  'pdf-splitter': () => import('@/components/tools/PdfSplitterTool').then((m) => ({ default: m.PdfSplitterTool })),
  'pdf-merger': () => import('@/components/tools/PdfMergerTool').then((m) => ({ default: m.PdfMergerTool })),
  'pdf-delete-pages': () => import('@/components/tools/PdfDeletePagesTool').then((m) => ({ default: m.PdfDeletePagesTool })),
  'pdf-extractor': () => import('@/components/tools/PdfExtractorTool').then((m) => ({ default: m.PdfExtractorTool })),
  'pdf-rotator': () => import('@/components/tools/PdfRotatorTool').then((m) => ({ default: m.PdfRotatorTool })),
  'jpg-to-pdf': () => import('@/components/tools/JpgToPdfTool').then((m) => ({ default: m.JpgToPdfTool })),
  'pdf-to-jpg': () => import('@/components/tools/PdfToJpgTool').then((m) => ({ default: m.PdfToJpgTool })),
  'pdf-compressor': () => import('@/components/tools/PdfCompressorTool').then((m) => ({ default: m.PdfCompressorTool })),
  'image-compressor': () => import('@/components/tools/ImageCompressorTool').then((m) => ({ default: m.ImageCompressorTool })),
  'image-resizer': () => import('@/components/tools/ImageResizerTool').then((m) => ({ default: m.ImageResizerTool })),
  'image-cropper': () => import('@/components/tools/ImageCropperTool').then((m) => ({ default: m.ImageCropperTool })),
  'image-converter': () => import('@/components/tools/ImageConverterTool').then((m) => ({ default: m.ImageConverterTool })),
  'image-text': () => import('@/components/tools/ImageTextTool').then((m) => ({ default: m.ImageTextTool })),
  'pdf-protector': () => import('@/components/tools/PdfProtectTool').then((m) => ({ default: m.PdfProtectTool })),
  'pdf-unlocker': () => import('@/components/tools/PdfUnlockTool').then((m) => ({ default: m.PdfUnlockTool })),
  'pdf-watermark': () => import('@/components/tools/PdfWatermarkTool').then((m) => ({ default: m.PdfWatermarkTool })),
  'pdf-page-numbers': () => import('@/components/tools/PdfPageNumbersTool').then((m) => ({ default: m.PdfPageNumbersTool })),
  'pdf-cropper': () => import('@/components/tools/PdfCropTool').then((m) => ({ default: m.PdfCropTool })),
  'pdf-organizer': () => import('@/components/tools/PdfOrganizerTool').then((m) => ({ default: m.PdfOrganizerTool })),
  'pdf-to-word': () => import('@/components/tools/PdfToWordTool').then((m) => ({ default: m.PdfToWordTool })),
  'pdf-to-excel': () => import('@/components/tools/PdfToExcelTool').then((m) => ({ default: m.PdfToExcelTool })),
  'pdf-to-powerpoint': () => import('@/components/tools/PdfToPowerPointTool').then((m) => ({ default: m.PdfToPowerPointTool })),
  'word-to-pdf': () => import('@/components/tools/WordToPdfTool').then((m) => ({ default: m.WordToPdfTool })),
}

export const toolRegistry: RegistryEntry[] = toolDefinitions.map((def) => {
  const loader = loaders[def.slug]
  if (!loader) throw new Error(`Missing loader for tool slug "${def.slug}"`)
  return { slug: def.slug, component: lazy(loader) }
})

export function getToolComponent(slug: string): ComponentType | undefined {
  return toolRegistry.find((entry) => entry.slug === slug)?.component
}
