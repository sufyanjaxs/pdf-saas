'use client'

import { OfficeConvertCard } from './OfficeConvertCard'
import { pdfToPowerPoint } from '@/lib/office'

export function PdfToPowerPointTool() {
  return (
    <OfficeConvertCard
      accept="application/pdf"
      hint="Select a PDF up to 200 MB"
      actionLabel="Convert to PowerPoint"
      outputName={(name) => `${name.replace(/\.pdf$/i, '')}.pptx`}
      convert={(bytes, onProgress) => pdfToPowerPoint(bytes, onProgress)}
    />
  )
}
