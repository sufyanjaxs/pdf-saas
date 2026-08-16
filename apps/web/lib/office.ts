'use client'

/**
 * Office conversion helpers (browser-only).
 *
 * These run on the main thread and lazily import their heavy dependencies so
 * the core bundle stays tiny. PDF.js handles reading + rendering PDF input;
 * docx / exceljs / pptxgenjs / mammoth build the output documents.
 *
 * Word/Excel/PowerPoint output is best-effort:
 *  - PDF → Word      extracts the text layer into paragraphs
 *  - PDF → Excel     extracts the text layer into rows (one row per line)
 *  - PDF → PPT       renders each page as an image slide
 *  - Word → PDF      extracts raw text and lays it out on A4 pages
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import { textToPdf } from '@pdf-saas/pdf-engine'
import type { Paragraph as DocxParagraph } from 'docx'

export type OfficeProgress = (pct: number, label?: string) => void

const noop = () => {}

function ensurePdfWorker() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/pdf.worker.min.js`
}

async function loadPdf(bytes: ArrayBuffer | Uint8Array) {
  ensurePdfWorker()
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const task = pdfjsLib.getDocument({ data: src })
  return task.promise
}

interface ExtractedPage {
  lines: string[]
  width: number
  height: number
}

/**
 * Reads the text layer of every page. Each line becomes one entry so the
 * downstream Word/Excel builds can keep some paragraph structure.
 */
async function extractTextPages(bytes: ArrayBuffer | Uint8Array, onProgress: OfficeProgress): Promise<ExtractedPage[]> {
  const doc = await loadPdf(bytes)
  const pages: ExtractedPage[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const lines: string[] = []
    let current = ''
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      const text = item.str ?? ''
      if (!text && !item.hasEOL) continue
      current += text
      if (item.hasEOL) {
        lines.push(current)
        current = ''
      }
    }
    if (current.trim()) lines.push(current)
    pages.push({ lines: lines.filter((l) => l.trim().length > 0), width: viewport.width, height: viewport.height })
    onProgress((n / doc.numPages) * 90, `Reading page ${n}…`)
  }
  return pages
}

async function renderPagesToJpeg(
  bytes: ArrayBuffer | Uint8Array,
  scale: number,
  quality: number,
  onProgress: OfficeProgress,
): Promise<Array<{ pageNumber: number; dataUrl: string; width: number; height: number }>> {
  const doc = await loadPdf(bytes)
  const out: Array<{ pageNumber: number; dataUrl: string; width: number; height: number }> = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    await page.render({ canvasContext: ctx, viewport }).promise
    out.push({ pageNumber: n, dataUrl: canvas.toDataURL('image/jpeg', quality), width: viewport.width, height: viewport.height })
    onProgress((n / doc.numPages) * 90, `Rendering page ${n}…`)
  }
  return out
}

/** PDF → Word (.docx). Each extracted line becomes a paragraph. */
export async function pdfToWord(bytes: ArrayBuffer | Uint8Array, onProgress: OfficeProgress = noop): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const pages = await extractTextPages(bytes, onProgress)
  const children: DocxParagraph[] = pages.flatMap((page, i) => [
    new Paragraph({
      children: [new TextRun({ text: `Page ${i + 1}`, bold: true, size: 28 })],
      spacing: { before: 240, after: 120 },
    }),
    ...page.lines.map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 60 },
        }),
    ),
  ])
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children.length > 0 ? children : [new Paragraph({ children: [new TextRun('')] })],
      },
    ],
  })
  onProgress(100, 'Packaging document…')
  return Packer.toBlob(doc)
}

/** PDF → Excel (.xlsx). One sheet, one row per extracted line. */
export async function pdfToExcel(bytes: ArrayBuffer | Uint8Array, onProgress: OfficeProgress = noop): Promise<Blob> {
  const ExcelJS = await import('exceljs')
  const pages = await extractTextPages(bytes, onProgress)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Extracted Text')
  ws.columns = [
    { header: 'Page', key: 'page', width: 8 },
    { header: 'Line', key: 'line', width: 10 },
    { header: 'Text', key: 'text', width: 100 },
  ]
  ws.getRow(1).font = { bold: true }
  let rowNum = 2
  pages.forEach((page, i) => {
    page.lines.forEach((line, j) => {
      ws.getRow(rowNum).getCell(1).value = i + 1
      ws.getRow(rowNum).getCell(2).value = j + 1
      ws.getRow(rowNum).getCell(3).value = line
      rowNum += 1
    })
  })
  onProgress(100, 'Writing spreadsheet…')
  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** PDF → PowerPoint (.pptx). Each page becomes an image slide. */
export async function pdfToPowerPoint(bytes: ArrayBuffer | Uint8Array, onProgress: OfficeProgress = noop): Promise<Blob> {
  const PptxGenJS = await import('pptxgenjs')
  const slides = await renderPagesToJpeg(bytes, 2, 0.85, onProgress)
  const pptx = new PptxGenJS.default()
  slides.forEach((slide, i) => {
    pptx.defineLayout({ name: `PDF${i}`, width: slide.width / 96, height: slide.height / 96 })
  })

  slides.forEach((slide, i) => {
    pptx.layout = `PDF${i}`
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }
    s.addImage({
      data: slide.dataUrl.replace(/^data:image\/\w+;base64,/, ''),
      x: 0,
      y: 0,
      w: slide.width / 96,
      h: slide.height / 96,
    })
    onProgress(((i + 1) / slides.length) * 90, `Building slide ${i + 1}…`)
  })

  onProgress(100, 'Packaging presentation…')
  const blob = (await pptx.write({ outputType: 'blob' })) as Blob
  return blob
}

/** Word (.docx) → PDF. Uses mammoth to extract raw text, then lays it out on A4 pages. */
export async function docxToPdf(bytes: ArrayBuffer | Uint8Array, onProgress: OfficeProgress = noop): Promise<Blob> {
  onProgress(20, 'Reading Word document…')
  const mammoth = await import('mammoth')
  const copy = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  const input = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer
  const result = await mammoth.extractRawText({ arrayBuffer: input })
  onProgress(60, 'Laying out text…')
  const pdfBytes = await textToPdf({ text: result.value })
  onProgress(100, 'Finishing…')
  return new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' })
}
