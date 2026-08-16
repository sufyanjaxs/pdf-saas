'use client'

import { OfficeConvertCard } from './OfficeConvertCard'
import { docxToPdf } from '@/lib/office'

export function WordToPdfTool() {
  return (
    <OfficeConvertCard
      accept=".docx,.doc"
      hint="Select a Word document up to 200 MB"
      actionLabel="Convert to PDF"
      outputName={(name) => `${name.replace(/\.(docx|doc)$/i, '')}.pdf`}
      convert={(bytes, onProgress) => docxToPdf(bytes, onProgress)}
    />
  )
}
