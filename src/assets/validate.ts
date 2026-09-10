/** Guards applied to every incoming file, before anything is decoded. */

export const MAX_FILE_BYTES = 50 * 1024 * 1024
/** Caps decompression bombs: a 60000x60000 PNG is a few KB on disk. */
export const MAX_PIXELS = 100_000_000

export type RejectReason = 'not-an-image' | 'svg-not-supported' | 'too-large' | 'too-many-pixels' | 'corrupt'

export interface Rejection {
  name: string
  reason: RejectReason
}

const SUPPORTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'] as const

/**
 * SVG is refused outright: it is a document that can carry script and external
 * references, and nothing in the product needs vector input. Revisit in Phase 6
 * behind rasterisation. See section 10 of the product plan.
 */
export function checkFile(file: { name: string; type: string; size: number }): RejectReason | null {
  if (file.type === 'image/svg+xml' || /\.svgz?$/i.test(file.name)) return 'svg-not-supported'
  if (!file.type.startsWith('image/')) return 'not-an-image'
  if (!SUPPORTED.includes(file.type as (typeof SUPPORTED)[number])) return 'not-an-image'
  if (file.size > MAX_FILE_BYTES) return 'too-large'
  return null
}

const MAGIC: [string, number[]][] = [
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/gif', [0x47, 0x49, 0x46, 0x38]],
  ['image/bmp', [0x42, 0x4d]],
]

/**
 * The OS-supplied MIME type is a hint, not evidence. Sniff the bytes so a
 * renamed file cannot reach the decoder claiming to be something it is not.
 */
export function sniffType(head: Uint8Array): string | null {
  for (const [type, sig] of MAGIC) {
    if (sig.every((b, i) => head[i] === b)) return type
  }
  // RIFF....WEBP
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57) {
    return 'image/webp'
  }
  // ISO-BMFF brand box, used by AVIF and HEIC alike.
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = String.fromCharCode(head[8]!, head[9]!, head[10]!, head[11]!)
    if (brand.startsWith('avi')) return 'image/avif'
    if (brand.startsWith('hei') || brand.startsWith('mif')) return 'image/heic'
  }
  return null
}

export function checkPixels(w: number, h: number): RejectReason | null {
  return w * h > MAX_PIXELS ? 'too-many-pixels' : null
}
