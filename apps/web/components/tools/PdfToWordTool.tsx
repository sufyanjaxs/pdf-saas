'use client'

import { OfficeConvertCard } from './OfficeConvertCard'
import { pdfToWord } from '@/lib/office'

export function PdfToWordTool() {
  return (
    <OfficeConvertCard
      accept="application/pdf"
      hint="Select a PDF up to 200 MB"
      actionLabel="Convert to Word"
      outputName={(name) => `${name.replace(/\.pdf$/i, '')}.docx`}
      convert={(bytes, onProgress) => pdfToWord(bytes, onProgress)}
    />
  )
}
