import { describe, it, expect } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import {
  splitPdf,
  deletePages,
  extractPages,
  rotatePdf,
  mergePdfs,
  imagesToPdf,
  compressPdf,
  reorderPdf,
  protectPdf,
  unlockPdf,
  watermarkPdf,
  addPageNumbers,
  cropPdf,
  parseRanges,
  textToPdf,
} from '../src/index'

async function makeTestPdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([300, 400])
    page.drawText(`Page ${i + 1}`, { x: 60, y: 200 })
  }
  return doc.save()
}

describe('splitPdf', () => {
  it('returns only the selected pages', async () => {
    const src = await makeTestPdf(4)
    const out = await splitPdf({ bytes: src, pages: [2, 4] })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPage(1).getMediaBox().width).toBe(300)
  })

  it('throws when no pages are selected', async () => {
    const src = await makeTestPdf(3)
    await expect(splitPdf({ bytes: src, pages: [] })).rejects.toThrow('Select at least one page')
  })
})

describe('deletePages', () => {
  it('removes the chosen pages', async () => {
    const src = await makeTestPdf(4)
    const out = await deletePages({ bytes: src, pages: [1, 3] })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
  })

  it('rejects deleting every page', async () => {
    const src = await makeTestPdf(2)
    await expect(deletePages({ bytes: src, pages: [1, 2] })).rejects.toThrow('Cannot delete every page')
  })
})

describe('extractPages', () => {
  it('extracts from a range string', async () => {
    const src = await makeTestPdf(5)
    const out = await extractPages({ bytes: src, ranges: '2-3,5' })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(3)
  })
})

describe('rotatePdf', () => {
  it('rotates all pages', async () => {
    const src = await makeTestPdf(2)
    const out = await rotatePdf({ bytes: src, pages: [], degrees: 90 })
    const doc = await PDFDocument.load(out)
    expect(doc.getPage(0).getRotation().angle).toBe(90)
    expect(doc.getPage(1).getRotation().angle).toBe(90)
  })

  it('rotates only selected pages', async () => {
    const src = await makeTestPdf(3)
    const out = await rotatePdf({ bytes: src, pages: [2], degrees: 270 })
    const doc = await PDFDocument.load(out)
    expect(doc.getPage(1).getRotation().angle).toBe(270)
    expect(doc.getPage(0).getRotation().angle).toBe(0)
  })
})

describe('mergePdfs', () => {
  it('combines documents in order', async () => {
    const a = await makeTestPdf(2)
    const b = await makeTestPdf(3)
    const out = await mergePdfs({ files: [a, b] })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(5)
  })
})

describe('imagesToPdf', () => {
  it('embeds a PNG as a page', async () => {
    const png = new Uint8Array(await (await import('node:fs/promises')).readFile(new URL('./fixtures/pixel.png', import.meta.url)))
    const out = await imagesToPdf({ files: [png], mimes: ['image/png'] })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(1)
  })
})

describe('compressPdf', () => {
  it('produces a valid, smaller PDF via object streams (node path)', async () => {
    const src = await makeTestPdf(5)
    const out = await compressPdf({ bytes: src, level: 'balanced' })
    expect(out.compressedSize).toBeLessThanOrEqual(out.originalSize)
    const doc = await PDFDocument.load(out.data)
    expect(doc.getPageCount()).toBe(5)
  })
})

describe('parseRanges', () => {
  it('parses like the UI expects', () => {
    expect(parseRanges('2, 5, 7–10')).toEqual([2, 5, 7, 8, 9, 10])
  })
})

describe('textToPdf', () => {
  it('produces a PDF with the given text on pages', async () => {
    const out = await textToPdf({ text: 'Hello world\nSecond line' })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28, 1)
  })

  it('paginates long text across multiple pages', async () => {
    const long = Array.from({ length: 200 }, (_, i) => `Line number ${i + 1}`).join('\n')
    const out = await textToPdf({ text: long })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBeGreaterThan(1)
  })
})

describe('reorderPdf', () => {
  it('orders pages by the given sequence', async () => {
    const src = await makeTestPdf(4)
    const out = await reorderPdf({ bytes: src, order: [3, 1, 4, 2] })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(4)
  })
})

describe('protectPdf', () => {
  it('produces an encrypted PDF that opens with the password', async () => {
    const src = await makeTestPdf(2)
    const out = await protectPdf({ bytes: src, password: 'secret123' })
    const locked = await PDFDocument.load(out, { ignoreEncryption: true })
    expect(locked.isEncrypted).toBe(true)
    const opened = await PDFDocument.load(out, { password: 'secret123' })
    expect(opened.getPageCount()).toBe(2)
  })

  it('rejects short passwords', async () => {
    const src = await makeTestPdf(1)
    await expect(protectPdf({ bytes: src, password: 'ab' })).rejects.toThrow('at least 4 characters')
  })
})

describe('unlockPdf', () => {
  it('removes encryption with the right password', async () => {
    const src = await makeTestPdf(1)
    const locked = await protectPdf({ bytes: src, password: 'secret123' })
    const out = await unlockPdf({ bytes: locked, password: 'secret123' })
    const doc = await PDFDocument.load(out)
    expect(doc.isEncrypted).toBe(false)
    expect(doc.getPageCount()).toBe(1)
  })
})

describe('watermarkPdf', () => {
  it('adds a watermark and stays valid', async () => {
    const src = await makeTestPdf(1)
    const out = await watermarkPdf({ bytes: src, text: 'CONFIDENTIAL', opacity: 0.2, size: 40 })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(1)
  })
})

describe('addPageNumbers', () => {
  it('adds page labels and stays valid', async () => {
    const src = await makeTestPdf(3)
    const out = await addPageNumbers({ bytes: src, position: 'bottom-right', format: 'Page {n} of {total}' })
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(3)
  })
})

describe('cropPdf', () => {
  it('sets a crop box that is smaller than the media box', async () => {
    const src = await makeTestPdf(1)
    const out = await cropPdf({ bytes: src, margins: { top: 10, right: 10, bottom: 10, left: 10 } })
    const doc = await PDFDocument.load(out)
    const box = doc.getPage(0).getCropBox()
    expect(box.width).toBeLessThan(300)
    expect(box.height).toBeLessThan(400)
  })
})
