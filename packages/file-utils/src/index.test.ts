import { describe, it, expect } from 'vitest'
import {
  formatBytes,
  parsePageRanges,
  validateFiles,
  sanitizeFileName,
  extensionFromMime,
  mimeFromExtension,
  uid,
} from '../src/index'

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(8.4 * 1024 * 1024)).toBe('8.4 MB')
    expect(formatBytes(-5)).toBe('0 B')
  })
})

describe('parsePageRanges', () => {
  it('parses comma separated and ranges', () => {
    expect(parsePageRanges('2,5,7-10')).toEqual([2, 5, 7, 8, 9, 10])
  })
  it('handles reversed ranges and whitespace', () => {
    expect(parsePageRanges('10-7 , 1')).toEqual([1, 7, 8, 9, 10])
  })
  it('respects max page count', () => {
    expect(parsePageRanges('1,3,5-9', 5)).toEqual([1, 3, 5])
  })
  it('ignores invalid tokens', () => {
    expect(parsePageRanges('abc,2,')).toEqual([2])
  })
})

describe('validateFiles', () => {
  function fakeFile(name: string, type: string, size = 1000): File {
    return { name, type, size } as unknown as File
  }

  it('accepts matching files', () => {
    const res = validateFiles([fakeFile('a.pdf', 'application/pdf')], {
      accept: 'application/pdf',
      extensions: ['pdf'],
      maxSizeMB: 10,
    })
    expect(res.valid).toBe(true)
  })

  it('accepts application/octet-stream for real PDFs', () => {
    const res = validateFiles([fakeFile('a.pdf', 'application/octet-stream')], {
      accept: 'application/pdf',
      extensions: ['pdf'],
    })
    expect(res.valid).toBe(true)
  })

  it('rejects wrong types', () => {
    const res = validateFiles([fakeFile('a.jpg', 'image/jpeg')], {
      accept: 'application/pdf',
    })
    expect(res.valid).toBe(false)
    expect(res.errors[0].reason).toContain('Unsupported file type')
  })

  it('rejects oversized files', () => {
    const res = validateFiles([fakeFile('a.pdf', 'application/pdf', 1024 * 1024 * 20)], {
      accept: 'application/pdf',
      maxSizeMB: 10,
    })
    expect(res.valid).toBe(false)
    expect(res.errors[0].reason).toContain('exceeds 10 MB')
  })
})

describe('misc helpers', () => {
  it('sanitizes filenames', () => {
    expect(sanitizeFileName('My File (1).pdf')).toBe('My-File-1.pdf')
  })
  it('maps mime <-> extension', () => {
    expect(extensionFromMime('image/webp')).toBe('webp')
    expect(mimeFromExtension('report.PDF')).toBe('application/pdf')
  })
  it('generates unique ids', () => {
    const a = uid()
    const b = uid()
    expect(a).not.toBe(b)
  })
})
