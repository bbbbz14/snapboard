import type { Point, Rect, Size } from '@/lib/geometry'
import { STYLE_PRESETS, type Background, type StylePreset } from '@/board/model/types'
import { strokeArrow } from './arrow'
import { strokeLine } from './line'
import { strokeBox } from './box'
import { drawMarker } from './marker'
import { fillRedact } from './redact'
import { drawText } from './text'

export interface RenderItem {
  id: string
  frame: Rect
  image: CanvasImageSource | null
  /** Normalized (0..1) source sub-rect to draw, mirroring `ImageNode.crop` -
   * absent means the whole image. */
  crop?: Rect
  /** 1-based step number drawn in the left gutter, when the layout has one. */
  badge?: number
}

export interface RenderArrow {
  id: string
  start: Point
  end: Point
  color: string
  size: number
  /** Absent (and old boards) means the original gently curved connector -
   * see `ArrowNode`'s own note on why this defaults to curved rather than
   * the tool's own new default of straight. */
  straight?: boolean
}

export interface RenderLine {
  id: string
  start: Point
  end: Point
  color: string
  size: number
}

export interface RenderBox {
  id: string
  frame: Rect
  color: string
  size: number
}

export interface RenderText {
  id: string
  frame: Rect
  text: string
  color: string
  size: number
}

export interface RenderMarker {
  id: string
  frame: Rect
  /** 1-based, derived from placement order among markers only - see `toRenderInput`. */
  number: number
  color: string
}

export interface RenderRedact {
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
  lines?: RenderLine[]
  /** Optional for the same reason `arrows` is. */
  boxes?: RenderBox[]
  /** Optional for the same reason `arrows` is. Excludes whichever text node
   * BoardCanvas currently has open in its textarea overlay - see invariant 1's
   * note there about why that can't drift, it just never reaches this input. */
  texts?: RenderText[]
  /** Optional for the same reason `arrows` is. */
  markers?: RenderMarker[]
  /** Optional for the same reason `arrows` is. */
  redacts?: RenderRedact[]
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
  } else if (input.background.type === 'gradient') {
    // Corner-to-corner, not axis-aligned - reads as one consistent diagonal
    // sweep regardless of the board's own aspect ratio.
    const g = ctx.createLinearGradient(0, 0, input.size.w, input.size.h)
    g.addColorStop(0, input.background.from)
    g.addColorStop(1, input.background.to)
    ctx.fillStyle = g
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
      drawFramedImage(ctx, item.frame, item.image, input.style, item.crop)
    }
  }

  // Redactions must permanently blot out whatever's underneath, so they draw
  // immediately after the images and before every other annotation kind -
  // an arrow, box, text or marker added afterward can still point at or
  // label a redaction, but nothing that draws before it (only the images)
  // could ever show through it.
  for (const redact of input.redacts ?? []) {
    fillRedact(ctx, redact.frame, redact.color)
  }

  // Boxes, lines, and arrows are drawn on top of every image - they exist to
  // point at or frame something already on the board, so they must never end
  // up underneath it. Boxes first so an arrow/line can still point across a
  // box's outline without being interrupted by it.
  for (const box of input.boxes ?? []) {
    strokeBox(ctx, box.frame, box.color, box.size)
  }
  for (const line of input.lines ?? []) {
    strokeLine(ctx, line.start, line.end, line.color, line.size)
  }
  for (const arrow of input.arrows ?? []) {
    strokeArrow(ctx, arrow.start, arrow.end, arrow.color, arrow.size, arrow.straight ?? false)
  }
  // Text last of the three annotation kinds - it often labels an arrow or a
  // box, so it must stay on top of both to stay legible.
  for (const text of input.texts ?? []) {
    drawText(ctx, text.frame, text.text, text.color, text.size)
  }

  // Markers are a numbered pin meant to flag a spot on top of whatever's
  // already there, so they draw last of all four annotation kinds.
  for (const marker of input.markers ?? []) {
    drawMarker(ctx, marker.frame, marker.number, marker.color)
  }

  // Badges are drawn after the images (and arrows/boxes/text/markers) so they are never clipped by a tile.
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

export function drawFramedImage(ctx: Ctx2D, frame: Rect, image: CanvasImageSource, style: StylePreset, crop?: Rect): void {
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
  if (crop) {
    const { w: iw, h: ih } = imageSize(image)
    ctx.drawImage(image, crop.x * iw, crop.y * ih, crop.w * iw, crop.h * ih, frame.x, frame.y, frame.w, frame.h)
  } else {
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h)
  }
  ctx.restore()
}

/** Every image source this codebase ever draws is an `ImageBitmap`
 * (`AssetStore.display`, and the render-parity test harness's own fixtures)
 * - `CanvasImageSource` is a wider union only because the DOM type says so. */
function imageSize(image: CanvasImageSource): Size {
  const bitmap = image as ImageBitmap
  return { w: bitmap.width, h: bitmap.height }
}

export const BADGE_DIAMETER = 44

/** The step badge's own colors. Named rather than inlined so it's obvious
 * they are *board content* - they land in the exported file, so unlike the
 * app's chrome they must never follow the OS theme, and in particular must
 * not be swapped for the `--accent`/`--surface` CSS tokens they happen to
 * share a value with today (see the two token groups in app/styles.css). */
export const BADGE_FILL_COLOR = '#2563eb'
export const BADGE_TEXT_COLOR = '#ffffff'
/** Fallback ring color where the board has no solid color to match. */
const BADGE_RING_ON_TRANSPARENT = 'rgba(255,255,255,0.9)'

/** Numbered marker in the gutter, so a stack of screenshots reads as a sequence. */
function drawBadge(ctx: Ctx2D, item: RenderItem, background: Background): void {
  const r = BADGE_DIAMETER / 2
  const cx = item.frame.x - 26
  const cy = item.frame.y + r
  if (cx - r < 0) return

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = BADGE_FILL_COLOR
  ctx.fill()
  // A ring keeps the badge legible where it overlaps a dark background.
  // Only a solid background has one single color to match; transparent and
  // gradient boards (no fixed color to pick) both fall back to the same
  // translucent ring, which reads fine against a gradient's whole range.
  ctx.lineWidth = 2
  ctx.strokeStyle = background.type === 'solid' ? background.color : BADGE_RING_ON_TRANSPARENT
  ctx.stroke()

  ctx.fillStyle = BADGE_TEXT_COLOR
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
