import type { Point, Rect } from '@/lib/geometry'
import { clamp, rectFromPoints } from '@/lib/geometry'
import type { Corner } from './resize'

/** Normalized crop rect meaning "the whole image, uncropped" - the implicit
 * default for any `ImageNode` without a `crop` field (see model/types.ts). */
export const FULL_CROP: Rect = { x: 0, y: 0, w: 1, h: 1 }

/** Board-space size below which a crop window refuses to shrink further -
 * same purpose as resize.ts's own MIN_SIZE, kept separate since the two
 * interactions are otherwise unrelated. */
export const CROP_MIN_SIZE = 24

/**
 * The board-space rect the *entire* source image would occupy, given a
 * node's current `frame` and `crop`. A crop session opens by showing this
 * full rect (dimmed outside the current `frame`, which is exactly what's
 * visible today) so dragging a handle back out towards its edge reads as
 * "reveal more of the image" - the classic crop-tool interaction.
 */
export function fullImageRect(frame: Rect, crop: Rect): Rect {
  const w = frame.w / crop.w
  const h = frame.h / crop.h
  return { x: frame.x - crop.x * w, y: frame.y - crop.y * h, w, h }
}

/**
 * Resizes the crop window by dragging `corner` to board-space point `p`,
 * anchored at the opposite corner and clamped to stay within `bounds` (the
 * full image rect - a crop can never reveal more than the source has) and
 * never smaller than `CROP_MIN_SIZE`. Unlike `resizeKeepingAspect`, this is a
 * free rectangle resize: a crop trims each edge independently, with no
 * aspect ratio to preserve.
 */
export function resizeCropWindow(win: Rect, corner: Corner, p: Point, bounds: Rect): Rect {
  const anchor: Point = {
    x: corner.includes('w') ? win.x + win.w : win.x,
    y: corner.includes('n') ? win.y + win.h : win.y,
  }
  const clamped: Point = {
    x: clamp(p.x, bounds.x, bounds.x + bounds.w),
    y: clamp(p.y, bounds.y, bounds.y + bounds.h),
  }
  const rect = rectFromPoints(anchor, clamped)
  let { x, y, w, h } = rect
  if (w < CROP_MIN_SIZE) {
    w = CROP_MIN_SIZE
    x = corner.includes('w') ? anchor.x - w : anchor.x
  }
  if (h < CROP_MIN_SIZE) {
    h = CROP_MIN_SIZE
    y = corner.includes('n') ? anchor.y - h : anchor.y
  }
  return { x, y, w, h }
}

/**
 * Converts a board-space crop-window rect back to a normalized (0..1) crop
 * rect relative to `bounds` (the full image rect) - the inverse of
 * `fullImageRect`. The window itself becomes the node's new `frame`
 * unchanged; this is only the `ImageNode.crop` half of a commit.
 */
export function windowToCrop(win: Rect, bounds: Rect): Rect {
  return {
    x: (win.x - bounds.x) / bounds.w,
    y: (win.y - bounds.y) / bounds.h,
    w: win.w / bounds.w,
    h: win.h / bounds.h,
  }
}
