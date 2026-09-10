import { describe, it, expect } from 'vitest'
import { resolveScale, estimatePixels, exportFilename, SAFE_PIXEL_AREA } from '@/board/export/exportBoard'
import { sanitizeFilename, isCopyVerifiable } from '@/board/export/clipboard'

describe('resolveScale', () => {
  it('keeps the requested scale for an ordinary board', () => {
    expect(resolveScale({ w: 1264, h: 900 }, 2)).toEqual({ scale: 2, downscaled: false })
    expect(resolveScale({ w: 1264, h: 900 }, 3)).toEqual({ scale: 3, downscaled: false })
  })

  it('steps down until the output fits the safe area', () => {
    expect(resolveScale({ w: 5000, h: 4000 }, 3)).toEqual({ scale: 2, downscaled: true })
    expect(resolveScale({ w: 6000, h: 6000 }, 3)).toEqual({ scale: 1, downscaled: true })
  })

  it('never goes below 1x, because some output beats none', () => {
    const r = resolveScale({ w: 20000, h: 20000 }, 3)
    expect(r.scale).toBe(1)
    expect(r.downscaled).toBe(true)
  })

  it('accepts a board exactly at the limit', () => {
    const side = Math.floor(Math.sqrt(SAFE_PIXEL_AREA))
    expect(resolveScale({ w: side, h: side }, 1).scale).toBe(1)
  })
})

describe('estimatePixels', () => {
  it('scales both dimensions', () => {
    expect(estimatePixels({ w: 1200, h: 800 }, 2)).toEqual({ w: 2400, h: 1600 })
  })
})

describe('exportFilename', () => {
  it('is sortable and says where it came from', () => {
    const at = new Date(2026, 8, 10, 14, 32)
    expect(exportFilename('image/png', at)).toBe('snapboard-2026-09-10-1432.png')
    expect(exportFilename('image/jpeg', at)).toBe('snapboard-2026-09-10-1432.jpg')
  })

  it('zero-pads so names sort lexically', () => {
    expect(exportFilename('image/png', new Date(2026, 0, 5, 9, 7))).toBe('snapboard-2026-01-05-0907.png')
  })
})

describe('sanitizeFilename', () => {
  it('strips path separators', () => {
    // Separators become dashes and the leading dots are dropped, so the name
    // can never escape the download directory.
    expect(sanitizeFilename('../../etc/passwd.png')).toBe('-..-etc-passwd.png')
    expect(sanitizeFilename('C:\\Windows\\system32.png')).toBe('C--Windows-system32.png')
  })

  it('strips invisible control characters', () => {
    expect(sanitizeFilename('shot\u0007\u0000.png')).toBe('shot.png')
  })

  it('keeps ordinary names, spaces included', () => {
    expect(sanitizeFilename('my board.png')).toBe('my board.png')
  })

  it('always returns something usable', () => {
    expect(sanitizeFilename('')).toBe('snapboard.png')
    expect(sanitizeFilename('...')).toBe('snapboard.png')
  })

  it('caps the length', () => {
    expect(sanitizeFilename('a'.repeat(500)).length).toBe(120)
  })
})

describe('isCopyVerifiable', () => {
  it('trusts only the engines where copy was proven end to end', () => {
    expect(isCopyVerifiable('Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36')).toBe(true)
    expect(isCopyVerifiable('Mozilla/5.0 Chrome/140 Edg/140.0.0.0')).toBe(true)
    expect(isCopyVerifiable('Mozilla/5.0 Firefox/155.0')).toBe(false)
    expect(isCopyVerifiable('Mozilla/5.0 Version/26.0 Safari/605.1.15')).toBe(false)
  })
})
