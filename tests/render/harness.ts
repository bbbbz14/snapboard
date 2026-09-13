/**
 * Exercises the real renderer and export pipeline (not a prototype) so the
 * "what you see is what you export" guarantee is covered by tests, not just
 * by the Phase 0 spike. Dev-server only; never part of the production bundle.
 */
import { renderScene, type RenderInput } from '@/board/render/renderScene'
import { TileCache } from '@/board/render/tileCache'
import { computeLayout, type LayoutItem } from '@/board/layout/computeLayout'
import { exportBoard, resolveScale } from '@/board/export/exportBoard'
import { BACKGROUNDS, type BackgroundName, type StylePreset } from '@/board/model/types'
import type { Size } from '@/lib/geometry'

async function bitmapOf(w: number, h: number, hue: number): Promise<ImageBitmap> {
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = `hsl(${hue} 70% 55%)`
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(w * 0.1, h * 0.1, w * 0.3, h * 0.15)
  return createImageBitmap(c)
}

interface SceneSpec {
  sizes: [number, number][]
  mode: 'auto' | 'rows' | 'columns' | 'grid' | 'compare' | 'steps'
  style: StylePreset
  background: BackgroundName
  gap?: number
  padding?: number
}

async function buildScene(spec: SceneSpec): Promise<RenderInput> {
  const items: LayoutItem[] = spec.sizes.map(([w, h], i) => ({ id: `n${i}`, natural: { w, h } }))
  const layout = computeLayout(items, spec.mode, {
    gap: spec.gap ?? 20,
    padding: spec.padding ?? 32,
    targetWidth: 1200,
    columns: null,
  })
  const bitmaps = await Promise.all(spec.sizes.map(([w, h], i) => bitmapOf(w, h, i * 47)))
  return {
    size: layout.size,
    background: BACKGROUNDS[spec.background],
    style: spec.style,
    items: items.map((it, i) => ({
      id: it.id,
      frame: layout.frames[it.id]!,
      image: bitmaps[i]!,
      ...(layout.mode === 'steps' ? { badge: i + 1 } : {}),
    })),
  }
}

function diffStats(a: Uint8ClampedArray, b: Uint8ClampedArray, width = 0) {
  let over1 = 0
  let max = 0
  let box: { x0: number; y0: number; x1: number; y1: number } | null = null
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!))
    if (d > 1) {
      over1++
      if (width) {
        const p = i / 4
        const x = p % width
        const y = Math.floor(p / width)
        box = box
          ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) }
          : { x0: x, y0: y, x1: x, y1: y }
      }
    }
    if (d > max) max = d
  }
  return { pixelsOver1: over1, maxChannelError: max, diffBox: box }
}

function readAll(canvas: OffscreenCanvas): Uint8ClampedArray {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
}

/** Preview (with tile cache) vs export (without) must be pixel-identical. */
async function parityWithTiles(spec: SceneSpec) {
  const scene = await buildScene(spec)

  const preview = new OffscreenCanvas(scene.size.w, scene.size.h)
  const tiles = new TileCache(1)
  renderScene(preview.getContext('2d')!, scene, { scale: 1, tiles })

  const { blob } = await exportBoard(scene, { scale: 1, format: 'image/png' })
  const decoded = await createImageBitmap(blob)
  const exported = new OffscreenCanvas(scene.size.w, scene.size.h)
  exported.getContext('2d')!.drawImage(decoded, 0, 0)
  decoded.close()

  return { size: scene.size, ...diffStats(readAll(preview), readAll(exported), scene.size.w) }
}

/** Confirms a step badge is actually painted where the layout reserved space. */
async function badgePixel(spec: SceneSpec) {
  const scene = await buildScene(spec)
  const c = new OffscreenCanvas(scene.size.w, scene.size.h)
  const ctx = c.getContext('2d')!
  renderScene(ctx, scene, { scale: 1 })
  const first = scene.items[0]!
  // Offset from the centre: the white numeral occupies the middle of the disc.
  const px = ctx.getImageData(Math.round(first.frame.x - 26 - 14), Math.round(first.frame.y + 22), 1, 1).data
  // Debug: locate the badge fill anywhere on the canvas.
  const all = ctx.getImageData(0, 0, scene.size.w, scene.size.h).data
  let found: { x: number; y: number } | null = null
  for (let i = 0; i < all.length && !found; i += 4) {
    if (all[i + 2]! - all[i]! > 80 && all[i + 3]! > 200) {
      const p = i / 4
      found = { x: p % scene.size.w, y: Math.floor(p / scene.size.w) }
    }
  }
  return {
    r: px[0], g: px[1], b: px[2], a: px[3],
    hasBadge: first.badge !== undefined,
    sampledAt: { x: Math.round(first.frame.x - 26), y: Math.round(first.frame.y + 22) },
    firstFrame: first.frame,
    blueFoundAt: found,
    canvas: scene.size,
  }
}

/** Transparent backgrounds must stay transparent through export. */
async function alphaAtCorner(spec: SceneSpec) {
  const scene = await buildScene(spec)
  const { blob } = await exportBoard(scene, { scale: 1, format: 'image/png' })
  const bm = await createImageBitmap(blob)
  const c = new OffscreenCanvas(bm.width, bm.height)
  const ctx = c.getContext('2d')!
  ctx.drawImage(bm, 0, 0)
  bm.close()
  return { alpha: ctx.getImageData(1, 1, 1, 1).data[3] }
}

/** Proves the gradient fill actually varies corner-to-corner, not just that
 * it renders opaque - the parity scene above only proves preview and export
 * agree with each other, not that either is a real gradient. */
async function gradientCorners(spec: SceneSpec) {
  const scene = await buildScene(spec)
  const { blob } = await exportBoard(scene, { scale: 1, format: 'image/png' })
  const bm = await createImageBitmap(blob)
  // Read c.width/height, not bm.width/height, for the corner sample below -
  // ImageBitmap.close() zeroes those out on at least one engine here, which
  // silently turned "sample the last pixel" into "sample (-1,-1)" (out of
  // bounds, always transparent) the first time this was written.
  const c = new OffscreenCanvas(bm.width, bm.height)
  const ctx = c.getContext('2d')!
  ctx.drawImage(bm, 0, 0)
  bm.close()
  const topLeft = ctx.getImageData(0, 0, 1, 1).data
  const bottomRight = ctx.getImageData(c.width - 1, c.height - 1, 1, 1).data
  return {
    topLeft: [topLeft[0], topLeft[1], topLeft[2], topLeft[3]],
    bottomRight: [bottomRight[0], bottomRight[1], bottomRight[2], bottomRight[3]],
  }
}

async function exportSizes(spec: SceneSpec) {
  const scene = await buildScene(spec)
  const out: Record<string, unknown> = {}
  for (const scale of [1, 2, 3] as const) {
    const r = await exportBoard(scene, { scale, format: 'image/png' })
    out[`x${scale}`] = { w: r.pixels.w, h: r.pixels.h, applied: r.appliedScale, bytes: r.blob.size }
  }
  return { logical: scene.size, ...out }
}

const guardScale = ({ size, requested }: { size: Size; requested: number }) => resolveScale(size, requested)

Object.assign(window as unknown as Record<string, unknown>, {
  harness: { parityWithTiles, badgePixel, alphaAtCorner, gradientCorners, exportSizes, guardScale },
})
