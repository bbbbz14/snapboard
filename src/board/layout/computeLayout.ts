import { aspect, boundsOf, scaleToWidth, type Rect, type Size } from '@/lib/geometry'
import type { ResolvedLayoutMode } from '@/board/model/types'

export interface LayoutItem {
  id: string
  /** Intrinsic pixel size of the source image. */
  natural: Size
}

export interface LayoutOptions {
  gap: number
  padding: number
  /** Preferred content width. Rows/grid fill it; columns/steps cap to it. */
  targetWidth: number
  /** Force a column count for `grid`. */
  columns?: number | null
}

export interface LayoutResult {
  frames: Record<string, Rect>
  size: Size
  mode: ResolvedLayoutMode
}

/** Rows taller than this look like a slideshow rather than a board. */
const MAX_ROW_HEIGHT = 760
/** Images are never enlarged past their own pixels — upscaled screenshots look broken. */
const ALLOW_UPSCALE = false

const PORTRAIT_MAX_AR = 0.75
const WIDE_MIN_AR = 1.5
/** Two images within this ratio of each other read as a pair worth comparing. */
const COMPARE_TOLERANCE = 0.15

/**
 * Picks the mode a person would have picked, from the shapes of the images alone.
 * This is the product's core differentiator: dropping images should already look right.
 */
export function pickAutoMode(items: LayoutItem[], columnsHint?: number | null): ResolvedLayoutMode {
  if (items.length <= 1) return 'columns'
  const ars = items.map((i) => aspect(i.natural))

  if (items.length === 2) {
    const [a, b] = ars as [number, number]
    const similar = Math.abs(a - b) / Math.max(a, b) <= COMPARE_TOLERANCE
    if (similar) return 'compare'
  }

  // Phone screenshots: one row of tall images reads far better than a stack.
  if (ars.every((ar) => ar < PORTRAIT_MAX_AR)) return 'rows'

  // Full-width desktop captures: stacking keeps each one readable.
  if (ars.every((ar) => ar > WIDE_MIN_AR)) return 'columns'

  if (columnsHint) return 'grid'

  // Even counts of similar shapes tile cleanly.
  if ((items.length === 4 || items.length === 6) && spread(ars) <= 0.35) return 'grid'

  return 'rows'
}

function spread(values: number[]): number {
  const min = Math.min(...values)
  const max = Math.max(...values)
  return max === 0 ? 0 : (max - min) / max
}

export function computeLayout(
  items: LayoutItem[],
  mode: ResolvedLayoutMode | 'auto',
  opts: LayoutOptions,
): LayoutResult {
  const resolved = mode === 'auto' ? pickAutoMode(items, opts.columns) : mode
  if (items.length === 0) {
    return { frames: {}, size: { w: opts.targetWidth, h: Math.round(opts.targetWidth * 0.55) }, mode: resolved }
  }

  const placed =
    resolved === 'columns' || resolved === 'steps'
      ? layoutColumn(items, opts, resolved === 'steps')
      : resolved === 'grid'
        ? layoutGrid(items, opts)
        : resolved === 'compare'
          ? layoutCompare(items, opts)
          : layoutRows(items, opts)

  // The step gutter is empty space that still belongs to the content, so it has
  // to take part in the bounds or normalisation would collapse it.
  const reserved: Rect[] = resolved === 'steps' ? [{ x: 0, y: 0, w: STEP_GUTTER, h: 1 }] : []
  return finalize(placed, opts, resolved, reserved)
}

/** Shifts content to sit inside the padding and sizes the canvas to fit it exactly. */
function finalize(
  frames: Record<string, Rect>,
  opts: LayoutOptions,
  mode: ResolvedLayoutMode,
  reserved: Rect[] = [],
): LayoutResult {
  const b = boundsOf([...Object.values(frames), ...reserved])
  const dx = opts.padding - b.x
  const dy = opts.padding - b.y
  const shifted: Record<string, Rect> = {}
  for (const [id, r] of Object.entries(frames)) {
    shifted[id] = { ...r, x: Math.round(r.x + dx), y: Math.round(r.y + dy) }
  }
  return {
    frames: shifted,
    size: { w: Math.round(b.w + opts.padding * 2), h: Math.round(b.h + opts.padding * 2) },
    mode,
  }
}

/**
 * Single column capped to the target width.
 * Steps are left-aligned so numbered items read down one edge; a plain stack is
 * centred because a ragged left edge looks accidental there.
 */
function layoutColumn(items: LayoutItem[], opts: LayoutOptions, steps: boolean): Record<string, Rect> {
  const gutter = steps ? STEP_GUTTER : 0
  const width = Math.max(64, opts.targetWidth - gutter)
  const sizes = items.map((i) => scaleToWidth(i.natural, width, ALLOW_UPSCALE))
  const contentWidth = Math.max(...sizes.map((s) => s.w))
  const frames: Record<string, Rect> = {}
  let y = 0
  items.forEach((item, i) => {
    const s = sizes[i]!
    const x = steps ? gutter : Math.round((contentWidth - s.w) / 2)
    frames[item.id] = { x, y, w: s.w, h: s.h }
    y += s.h + opts.gap
  })
  return frames
}

/** Left gutter reserved for step badges so numbering never overlaps the image. */
export const STEP_GUTTER = 72

/** Justified rows: every row is exactly the target width, like a photo grid. */
function layoutRows(items: LayoutItem[], opts: LayoutOptions): Record<string, Rect> {
  const W = opts.targetWidth
  const targetHeight = Math.min(MAX_ROW_HEIGHT, Math.max(180, W / 3.2))
  const frames: Record<string, Rect> = {}

  const rows: LayoutItem[][] = []
  let row: LayoutItem[] = []
  for (const item of items) {
    row.push(item)
    if (rowHeight(row, W, opts.gap) <= targetHeight) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) rows.push(row)

  let y = 0
  rows.forEach((r, index) => {
    const isLast = index === rows.length - 1
    let h = rowHeight(r, W, opts.gap)
    // Stretching a short final row to full width distorts it; keep it natural.
    if (isLast && h > targetHeight) h = Math.min(h, targetHeight, naturalRowCap(r))
    h = Math.min(h, MAX_ROW_HEIGHT, naturalRowCap(r))

    const widths = r.map((item) => Math.round(aspect(item.natural) * h))
    const rowWidth = widths.reduce((a, b) => a + b, 0) + opts.gap * (r.length - 1)
    let x = Math.round((W - rowWidth) / 2)
    r.forEach((item, i) => {
      frames[item.id] = { x, y, w: widths[i]!, h: Math.round(h) }
      x += widths[i]! + opts.gap
    })
    y += Math.round(h) + opts.gap
  })
  return frames
}

const rowHeight = (row: LayoutItem[], width: number, gap: number): number => {
  const totalAspect = row.reduce((a, i) => a + aspect(i.natural), 0)
  return (width - gap * (row.length - 1)) / totalAspect
}

/** No image in a row may be drawn larger than its own pixels. */
const naturalRowCap = (row: LayoutItem[]): number => Math.min(...row.map((i) => i.natural.h))

function layoutGrid(items: LayoutItem[], opts: LayoutOptions): Record<string, Rect> {
  const cols = opts.columns ?? (items.length <= 3 ? items.length : items.length <= 6 ? 2 : 3)
  const cellW = Math.floor((opts.targetWidth - opts.gap * (cols - 1)) / cols)
  const sized = items.map((i) => ({ item: i, size: scaleToWidth(i.natural, cellW, ALLOW_UPSCALE) }))

  const frames: Record<string, Rect> = {}
  let y = 0
  for (let start = 0; start < sized.length; start += cols) {
    const rowItems = sized.slice(start, start + cols)
    const rowH = Math.max(...rowItems.map((s) => s.size.h))
    rowItems.forEach((s, i) => {
      const x = i * (cellW + opts.gap) + Math.round((cellW - s.size.w) / 2)
      frames[s.item.id] = { x, y: y + Math.round((rowH - s.size.h) / 2), w: s.size.w, h: s.size.h }
    })
    y += rowH + opts.gap
  }
  return frames
}

/** Two images side by side at equal height, so differences line up visually. */
function layoutCompare(items: LayoutItem[], opts: LayoutOptions): Record<string, Rect> {
  if (items.length !== 2) return layoutRows(items, opts)
  const [a, b] = items as [LayoutItem, LayoutItem]
  const available = opts.targetWidth - opts.gap
  const totalAspect = aspect(a.natural) + aspect(b.natural)
  const h = Math.min(available / totalAspect, a.natural.h, b.natural.h, MAX_ROW_HEIGHT)
  const wa = Math.round(aspect(a.natural) * h)
  const wb = Math.round(aspect(b.natural) * h)
  return {
    [a.id]: { x: 0, y: 0, w: wa, h: Math.round(h) },
    [b.id]: { x: wa + opts.gap, y: 0, w: wb, h: Math.round(h) },
  }
}
