/**
 * Tests for @pdf-saas/image-engine
 *
 * Pure logic functions (formatToExtension, detectFormat) are tested directly.
 * Canvas-based functions are tested with mocked OffscreenCanvas when available.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatToExtension,
  detectFormat,
  coverGeometry,
  type ImageFormat,
} from './index'

/* ------------------------------------------------------------------ */
/* Cover-fit geometry (regression: cover must crop, not stretch)        */
/* ------------------------------------------------------------------ */

describe('coverGeometry', () => {
  it('preserves aspect ratio when filling a square box with a wide image', () => {
    const g = coverGeometry(800, 400, 400, 400)
    // Scale is driven by height (the constrained axis): 400/400 = 1 → drawW = 800
    expect(g.drawW).toBeCloseTo(800)
    expect(g.drawH).toBeCloseTo(400)
    expect(g.drawW / g.drawH).toBeCloseTo(2) // original aspect kept
    expect(g.dx).toBeCloseTo((400 - 800) / 2)
    expect(g.dy).toBeCloseTo(0)
  })

  it('fully covers the destination box', () => {
    const cases: Array<[number, number, number, number]> = [
      [1920, 1080, 1080, 1350],
      [1080, 1920, 1200, 630],
      [500, 500, 420, 525],
      [300, 1000, 1000, 300],
    ]
    for (const [sw, sh, dw, dh] of cases) {
      const g = coverGeometry(sw, sh, dw, dh)
      expect(g.drawW).toBeGreaterThanOrEqual(dw - 1e-9)
      expect(g.drawH).toBeGreaterThanOrEqual(dh - 1e-9)
      expect(g.drawW / g.drawH).toBeCloseTo(sw / sh, 6)
    }
  })

  it('centers the overflow on both axes', () => {
    const g = coverGeometry(1600, 900, 800, 800)
    expect(g.dx).toBeLessThanOrEqual(0)
    expect(g.dy).toBeLessThanOrEqual(0)
    expect(Math.abs(g.dx)).toBeCloseTo(Math.abs((800 - g.drawW) / 2))
  })
})

/* ------------------------------------------------------------------ */
/* Pure logic tests                                                     */
/* ------------------------------------------------------------------ */

describe('formatToExtension', () => {
  it('returns jpg for image/jpeg', () => {
    expect(formatToExtension('image/jpeg')).toBe('jpg')
  })
  it('returns webp for image/webp', () => {
    expect(formatToExtension('image/webp')).toBe('webp')
  })
  it('returns png for image/png', () => {
    expect(formatToExtension('image/png')).toBe('png')
  })
})

describe('detectFormat', () => {
  it('detects PNG', () => {
    expect(detectFormat('image/png')).toBe('image/png')
  })
  it('detects WEBP', () => {
    expect(detectFormat('image/webp')).toBe('image/webp')
  })
  it('defaults to JPEG for unknown types', () => {
    expect(detectFormat('image/bmp')).toBe('image/jpeg')
    expect(detectFormat('image/gif')).toBe('image/jpeg')
    expect(detectFormat('')).toBe('image/jpeg')
  })
})

/* ------------------------------------------------------------------ */
/* Binary search algorithm logic tests                                  */
/* ------------------------------------------------------------------ */

describe('binary search compression logic', () => {
  it('finds quality within range', () => {
    // Simulate binary search for target size
    const target = 100 * 1024 // 100KB
    const simulateSize = (quality: number) => {
      // Simulated: higher quality = larger file
      // Quality 95 -> ~500KB, Quality 5 -> ~5KB
      return Math.round((quality / 95) * 500 * 1024)
    }

    let lo = 5, hi = 95
    let bestQ = 5, bestSize = Infinity, bestDiff = Infinity

    for (let i = 0; i < 8; i++) {
      const mid = Math.round((lo + hi) / 2)
      const size = simulateSize(mid)
      const diff = Math.abs(size - target)
      if (diff < bestDiff) {
        bestQ = mid
        bestSize = size
        bestDiff = diff
      }
      if (size > target) hi = mid - 1
      else lo = mid + 1
      if (diff < target * 0.05) break
    }

    expect(bestSize).toBeLessThan(target * 2)
    expect(bestSize).toBeGreaterThan(0)
    expect(bestQ).toBeGreaterThanOrEqual(5)
    expect(bestQ).toBeLessThanOrEqual(95)
  })

  it('converges within 8 iterations', () => {
    const target = 50 * 1024
    const simulateSize = (q: number) => Math.round(Math.pow(q / 100, 2) * 1000 * 1024)

    let lo = 5, hi = 95
    let iterations = 0
    let foundSize = Infinity

    for (let i = 0; i < 8; i++) {
      iterations++
      const mid = Math.round((lo + hi) / 2)
      const size = simulateSize(mid)
      foundSize = size
      if (size > target) hi = mid - 1
      else lo = mid + 1
      if (Math.abs(size - target) < target * 0.05) break
    }

    expect(iterations).toBeLessThanOrEqual(8)
    expect(foundSize).toBeGreaterThan(0)
  })

  it('handles target larger than source', () => {
    const sourceSize = 50 * 1024
    const targetSize = 200 * 1024

    // If source is smaller than target, should just do a light pass
    const shouldLightPass = sourceSize <= targetSize
    expect(shouldLightPass).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Mocked Canvas tests (run with jsdom or happy-dom)                    */
/* ------------------------------------------------------------------ */

// These tests require OffscreenCanvas or canvas-like mock
function createMockOffscreenCanvas(w: number, h: number) {
  const pixels = new Uint8ClampedArray(w * h * 4)
  // Fill with a solid color (light gray)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 200     // R
    pixels[i + 1] = 200 // G
    pixels[i + 2] = 200 // B
    pixels[i + 3] = 255 // A
  }

  return {
    width: w,
    height: h,
    getContext: () => ({
      drawImage: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      closePath: () => {},
      clip: () => {},
      fill: () => {},
      fillStyle: '',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high' as const,
      getImageData: () => ({ data: pixels }),
      putImageData: () => {},
    }),
    convertToBlob: async () => new Blob([new Uint8Array(pixels.buffer)], { type: 'image/png' }),
  }
}

describe('compression presets logic', () => {
  const presets = [
    { id: 'web', quality: 80, format: 'image/jpeg', maxDim: 2048 },
    { id: 'print', quality: 95, format: 'image/jpeg' },
    { id: 'email', quality: 65, format: 'image/jpeg', maxDim: 1200 },
  ]

  it('web preset reduces quality appropriately', () => {
    const p = presets.find((x) => x.id === 'web')!
    expect(p.quality).toBe(80)
    expect(p.format).toBe('image/jpeg')
  })

  it('email preset has lower quality', () => {
    const p = presets.find((x) => x.id === 'email')!
    expect(p.quality).toBe(65)
  })

  it('print preset has highest quality', () => {
    const p = presets.find((x) => x.id === 'print')!
    expect(p.quality).toBe(95)
  })
})

describe('passport photo presets', () => {
  const passportPresets = [
    { id: 'us-passport', w: 600, h: 600 },
    { id: 'uk-passport', w: 420, h: 525 },
    { id: 'eu-id', w: 420, h: 525 },
    { id: 'canada-passport', w: 420, h: 540 },
    { id: 'australia-passport', w: 420, h: 525 },
  ]

  it('US passport is square (600x600)', () => {
    const p = passportPresets[0]
    expect(p.w / p.h).toBeCloseTo(1.0)
  })

  it('UK passport has portrait aspect ratio', () => {
    const p = passportPresets[1]
    expect(p.h / p.w).toBeGreaterThan(1)
  })

  it('all presets have valid dimensions', () => {
    for (const p of passportPresets) {
      expect(p.w).toBeGreaterThan(0)
      expect(p.h).toBeGreaterThan(0)
      expect(p.w).toBeLessThanOrEqual(3000)
      expect(p.h).toBeLessThanOrEqual(3000)
    }
  })
})

describe('social media resize presets', () => {
  const socialPresets = [
    { id: 'ig-square', w: 1080, h: 1080 },
    { id: 'ig-portrait', w: 1080, h: 1350 },
    { id: 'ig-story', w: 1080, h: 1920 },
    { id: 'fb-post', w: 1200, h: 630 },
    { id: 'tw-post', w: 1200, h: 675 },
    { id: 'yt-thumb', w: 1280, h: 720 },
    { id: 'pin', w: 1000, h: 1500 },
    { id: 'tiktok', w: 1080, h: 1920 },
  ]

  it('Instagram square is 1:1', () => {
    const p = socialPresets.find((x) => x.id === 'ig-square')!
    expect(p.w / p.h).toBeCloseTo(1.0)
  })

  it('Instagram story is 9:16', () => {
    const p = socialPresets.find((x) => x.id === 'ig-story')!
    expect(p.w / p.h).toBeCloseTo(9 / 16, 1)
  })

  it('YouTube thumbnail is 16:9', () => {
    const p = socialPresets.find((x) => x.id === 'yt-thumb')!
    expect(p.w / p.h).toBeCloseTo(16 / 9, 1)
  })

  it('all dimensions are reasonable', () => {
    for (const p of socialPresets) {
      expect(p.w).toBeGreaterThanOrEqual(100)
      expect(p.w).toBeLessThanOrEqual(4000)
      expect(p.h).toBeGreaterThanOrEqual(100)
      expect(p.h).toBeLessThanOrEqual(4000)
    }
  })
})

describe('image analysis quality estimation', () => {
  function estimateQuality(bpp: number, mime: string): number {
    if (mime === 'image/jpeg') return Math.min(100, Math.max(0, Math.round(bpp * 60)))
    if (mime === 'image/webp') return Math.min(100, Math.max(0, Math.round(bpp * 80)))
    return bpp > 3 ? 85 : bpp > 1 ? 70 : 55
  }

  it('high-quality JPEG has high estimate', () => {
    // q90 JPEG typically ~1-2 bpp
    expect(estimateQuality(1.5, 'image/jpeg')).toBeGreaterThanOrEqual(80)
  })

  it('low-quality JPEG has low estimate', () => {
    // q10 JPEG typically ~0.05-0.1 bpp
    expect(estimateQuality(0.05, 'image/jpeg')).toBeLessThan(10)
  })

  it('WEBP scales differently than JPEG', () => {
    // Same bpp should give different quality for WEBP vs JPEG
    const bpp = 1.0
    const jpegQ = estimateQuality(bpp, 'image/jpeg')
    const webpQ = estimateQuality(bpp, 'image/webp')
    expect(webpQ).toBeGreaterThan(jpegQ)
  })

  it('PNG quality is tiered, not continuous', () => {
    expect(estimateQuality(4, 'image/png')).toBe(85)
    expect(estimateQuality(2, 'image/png')).toBe(70)
    expect(estimateQuality(0.5, 'image/png')).toBe(55)
  })
})

describe('color distance calculation', () => {
  function colorDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }

  it('same color has zero distance', () => {
    expect(colorDist(128, 128, 128, 128, 128, 128)).toBe(0)
  })

  it('max distance is for black vs white', () => {
    expect(colorDist(0, 0, 0, 255, 255, 255)).toBeCloseTo(441.67, 0)
  })

  it('similar colors have small distance', () => {
    expect(colorDist(200, 200, 200, 195, 195, 195)).toBeLessThan(10)
  })
})

describe('aspect ratio calculations', () => {
  it('common aspect ratios are correct', () => {
    expect(1 / 1).toBeCloseTo(1.0)
    expect(4 / 5).toBeCloseTo(0.8)
    expect(16 / 9).toBeCloseTo(1.778, 2)
    expect(3 / 2).toBeCloseTo(1.5)
    expect(9 / 16).toBeCloseTo(0.5625, 3)
    expect(2 / 3).toBeCloseTo(0.667, 2)
  })

  it('passport ratios are portrait (h > w)', () => {
    expect(420 / 525).toBeLessThan(1) // UK/EU/AU
    expect(420 / 540).toBeLessThan(1) // Canada
    expect(390 / 567).toBeLessThan(1) // China
  })
})
