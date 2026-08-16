'use client'

import { OfficeConvertCard } from './OfficeConvertCard'
import { pdfToExcel } from '@/lib/office'

export function PdfToExcelTool() {
  return (
    <OfficeConvertCard
      accept="application/pdf"
      hint="Select a PDF up to 200 MB"
      actionLabel="Convert to Excel"
      outputName={(name) => `${name.replace(/\.pdf$/i, '')}.xlsx`}
      convert={(bytes, onProgress) => pdfToExcel(bytes, onProgress)}
    />
  )
}
