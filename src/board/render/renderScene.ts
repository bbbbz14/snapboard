import type { Point, Rect, Size } from '@/lib/geometry'
import { STYLE_PRESETS, type Background, type StylePreset } from '@/board/model/types'
import { ARROW_STROKE_WIDTH, strokeArrow } from './arrow'
import { BOX_STROKE_WIDTH, strokeBox } from './box'

export interface RenderItem {
  id: string
  frame: Rect
  image: CanvasImageSource | null
  /** 1-based step number drawn in the left gutter, when the layout has one. */
  badge?: number
}

export interface RenderArrow {
  id: string
  start: Point
  end: Point
  color: string
}

export interface RenderBox {
  id: string
  frame: Rect
  color: string
}

export interface RenderInput {
  size: Size
  background: Background
  style: StylePreset
  items: RenderItem[]
  /** Optional so `tests/render/harness.ts`'s scenes (image-only) don't need
   * to know arrows exist. */
  arrows?: RenderArrow[]
  /** Optional for the same reason `arrows` is. */
  boxes?: RenderBox[]
}

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface RenderOptions {
  /** 1 for preview, 2/3 for hi-DPI export. The only difference between the two paths. */
  scale: number
  /** Pre-rendered per-node tiles. Preview only — export always draws at full quality. */
  tiles?: TileProvider
  /**
   * Device-pixel translation applied after `scale`. Preview-only (pan/zoom):
   * the export path never sets this, so omitting it must reproduce the exact
   * pre-Phase-2 transform — see invariant 1.
   */
  offset?: Point
}

export interface Tile {
  canvas: CanvasImageSource
  /** Offset of the frame inside the tile, in logical units. */
  dx: number
  dy: number
  /** Logical size to draw the tile at; its backing store may be higher resolution. */
  w: number
  h: number
}

export interface TileProvider {
  get(item: RenderItem, style: StylePreset): Tile | null
}

/**
 * The single renderer behind both the on-screen board and the exported file.
 * Verified pixel-identical across Chromium, Firefox and WebKit — see ADR-001.
 */
export function renderScene(ctx: Ctx2D, input: RenderInput, { scale, tiles, offset }: RenderOptions): void {
  ctx.save()
  ctx.setTransform(scale, 0, 0, scale, offset?.x ?? 0, offset?.y ?? 0)

  if (input.background.type === 'solid') {
    ctx.fillStyle = input.background.color
    ctx.fillRect(0, 0, input.size.w, input.size.h)
  } else {
    ctx.clearRect(0, 0, input.size.w, input.size.h)
  }

  for (const item of input.items) {
    if (!item.image) {
      drawPlaceholder(ctx, item.frame, input.style)
      continue
    }
    const tile = tiles?.get(item, input.style)
    if (tile) {
      ctx.drawImage(tile.canvas, item.frame.x - tile.dx, item.frame.y - tile.dy, tile.w, tile.h)
    } else {
      drawFramedImage(ctx, item.frame, item.image, input.style)
    }
  }

  // Boxes and arrows are drawn on top of every image - they exist to point
  // at or frame something already on the board, so they must never end up
  // underneath it. Boxes first so an arrow can still point across a box's
  // outline without being interrupted by it.
  for (const box of input.boxes ?? []) {
    strokeBox(ctx, box.frame, box.color, BOX_STROKE_WIDTH)
  }
  for (const arrow of input.arrows ?? []) {
    strokeArrow(ctx, arrow.start, arrow.end, arrow.color, ARROW_STROKE_WIDTH)
  }

  // Badges are drawn after the images (and arrows/boxes) so they are never clipped by a tile.
  for (const item of input.items) {
    if (item.badge !== undefined) drawBadge(ctx, item, input.background)
  }

  ctx.restore()
}

/** How far a style's shadow can bleed outside the frame. Sizes the tile margin. */
export function styleMargin(style: StylePreset): number {
  const s = STYLE_PRESETS[style].shadow
  return s ? Math.ceil(s.blur + s.offsetY + 4) : 0
}

export function roundedPath(ctx: Ctx2D, r: Rect, radius: number): void {
  const k = Math.max(0, Math.min(radius, r.w / 2, r.h / 2))
  ctx.beginPath()
  if (k === 0) {
    ctx.rect(r.x, r.y, r.w, r.h)
  } else {
    ctx.moveTo(r.x + k, r.y)
    ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k)
    ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k)
    ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k)
    ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k)
  }
  ctx.closePath()
}

export function drawFramedImage(ctx: Ctx2D, frame: Rect, image: CanvasImageSource, style: StylePreset): void {
  const preset = STYLE_PRESETS[style]
  ctx.save()
  if (preset.shadow) {
    // Fill the silhouette to cast the shadow, then clip it away before drawing
    // the image, so transparent PNGs don't show the fill through themselves.
    ctx.shadowColor = preset.shadow.color
    ctx.shadowBlur = preset.shadow.blur
    ctx.shadowOffsetY = preset.shadow.offsetY
    ctx.fillStyle = '#ffffff'
    roundedPath(ctx, frame, preset.radius)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }
  roundedPath(ctx, frame, preset.radius)
  ctx.clip()
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h)
  ctx.restore()
}

export const BADGE_DIAMETER = 44

/** Numbered marker in the gutter, so a stack of screenshots reads as a sequence. */
function drawBadge(ctx: Ctx2D, item: RenderItem, background: Background): void {
  const r = BADGE_DIAMETER / 2
  const cx = item.frame.x - 26
  const cy = item.frame.y + r
  if (cx - r < 0) return

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#2563eb'
  ctx.fill()
  // A ring keeps the badge legible where it overlaps a dark background.
  ctx.lineWidth = 2
  ctx.strokeStyle = background.type === 'solid' ? background.color : 'rgba(255,255,255,0.9)'
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${Math.round(BADGE_DIAMETER * 0.5)}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(item.badge), cx, cy + 1)
  ctx.restore()
}

/** Shown while an image is still decoding, in the slot it will occupy. */
function drawPlaceholder(ctx: Ctx2D, frame: Rect, style: StylePreset): void {
  ctx.save()
  ctx.fillStyle = 'rgba(148, 163, 184, 0.22)'
  roundedPath(ctx, frame, STYLE_PRESETS[style].radius)
  ctx.fill()
  ctx.restore()
}
