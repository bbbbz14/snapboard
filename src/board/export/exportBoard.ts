import type { Size } from '@/lib/geometry'
import { renderScene, type RenderInput } from '@/board/render/renderScene'
import { ensureAnnotationFont } from '@/board/render/text'

export type ExportFormat = 'image/png' | 'image/jpeg'

export interface ExportOptions {
  scale: 1 | 2 | 3
  format: ExportFormat
  quality?: number
}

export interface ExportResult {
  blob: Blob
  pixels: Size
  /** May be lower than requested when the canvas would exceed the safe area. */
  appliedScale: number
  downscaled: boolean
}

/**
 * Well under every limit measured in Phase 0 (268 MP on Chromium and WebKit,
 * 537 MP on Firefox) because mobile Safari is far lower and untested. See ADR-005.
 */
export const SAFE_PIXEL_AREA = 100_000_000

/** Reduces the requested scale until the output fits the safe area. */
export function resolveScale(size: Size, requested: number): { scale: number; downscaled: boolean } {
  let scale = requested
  while (scale > 1 && size.w * scale * size.h * scale > SAFE_PIXEL_AREA) scale -= 1
  return { scale, downscaled: scale < requested }
}

export function estimatePixels(size: Size, scale: number): Size {
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) }
}

export async function exportBoard(input: RenderInput, opts: ExportOptions): Promise<ExportResult> {
  const { scale, downscaled } = resolveScale(input.size, opts.scale)
  const pixels = estimatePixels(input.size, scale)

  const canvas = new OffscreenCanvas(pixels.w, pixels.h)
  // The alpha flag must match the preview context. An opaque canvas switches
  // Chromium to subpixel text antialiasing, which made exported glyphs differ
  // from the ones on screen by up to 100 levels per channel.
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create an export canvas')

  // JPEG has no alpha; without a backdrop a transparent board turns black.
  if (opts.format === 'image/jpeg' && input.background.type === 'transparent') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pixels.w, pixels.h)
  }

  // Canvas fillText has no font-display equivalent - a face still loading
  // when this draws would silently fall back to a system font in the
  // exported file. Cheap once loaded (see render/text.ts): resolves
  // instantly on every export after the first.
  if ((input.texts?.length ?? 0) > 0) await ensureAnnotationFont()

  // No tile cache here: tiles are display-resolution, export must be full quality.
  renderScene(ctx, input, { scale })

  const blob = await canvas.convertToBlob({
    type: opts.format,
    ...(opts.format === 'image/jpeg' ? { quality: opts.quality ?? 0.92 } : {}),
  })

  return { blob, pixels, appliedScale: scale, downscaled }
}

/** e.g. snapboard-2026-09-10-1432.png - sortable, and says where it came from. */
export function exportFilename(format: ExportFormat, at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}`
  return `snapboard-${stamp}.${format === 'image/jpeg' ? 'jpg' : 'png'}`
}
