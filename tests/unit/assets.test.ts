import { describe, it, expect } from 'vitest'
import { checkFile, checkPixels, sniffType, MAX_FILE_BYTES } from '@/assets/validate'

const file = (name: string, type: string, size = 1000) => ({ name, type, size })

describe('checkFile', () => {
  it('accepts the formats a screenshot can actually be', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']) {
      expect(checkFile(file('shot', type))).toBeNull()
    }
  })

  it('refuses SVG regardless of how it is labelled', () => {
    expect(checkFile(file('a.svg', 'image/svg+xml'))).toBe('svg-not-supported')
    expect(checkFile(file('a.svg', 'image/png'))).toBe('svg-not-supported')
    expect(checkFile(file('a.SVGZ', 'image/png'))).toBe('svg-not-supported')
  })

  it('refuses non-images', () => {
    expect(checkFile(file('notes.pdf', 'application/pdf'))).toBe('not-an-image')
    expect(checkFile(file('clip.mp4', 'video/mp4'))).toBe('not-an-image')
    expect(checkFile(file('photo.heic', 'image/heic'))).toBe('not-an-image')
  })

  it('refuses files past the size cap', () => {
    expect(checkFile(file('huge.png', 'image/png', MAX_FILE_BYTES + 1))).toBe('too-large')
    expect(checkFile(file('ok.png', 'image/png', MAX_FILE_BYTES))).toBeNull()
  })
})

describe('sniffType', () => {
  const head = (bytes: number[]) => new Uint8Array([...bytes, ...Array(16 - bytes.length).fill(0)])

  it('identifies real image headers', () => {
    expect(sniffType(head([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffType(head([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffType(head([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif')
    expect(sniffType(head([0x42, 0x4d]))).toBe('image/bmp')
  })

  it('identifies WEBP through the RIFF container', () => {
    const bytes = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]
    expect(sniffType(head(bytes))).toBe('image/webp')
  })

  it('distinguishes AVIF from HEIC in the ISO-BMFF brand', () => {
    const brand = (s: string) => head([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, ...[...s].map((c) => c.charCodeAt(0))])
    expect(sniffType(brand('avif'))).toBe('image/avif')
    expect(sniffType(brand('heic'))).toBe('image/heic')
  })

  it('rejects a file that only claims to be an image', () => {
    expect(sniffType(head([0x25, 0x50, 0x44, 0x46]))).toBeNull()
    expect(sniffType(head([0x3c, 0x73, 0x76, 0x67]))).toBeNull()
  })
})

describe('checkPixels', () => {
  it('allows a large but sane screenshot', () => {
    expect(checkPixels(7680, 4320)).toBeNull()
    expect(checkPixels(1440, 20000)).toBeNull()
  })

  it('blocks a decompression bomb', () => {
    expect(checkPixels(30000, 30000)).toBe('too-many-pixels')
  })
})
