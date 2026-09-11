import type { Point, Rect } from '@/lib/geometry'

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

const MIN_SIZE = 8

/**
 * Resizes `frame` by dragging `corner` to board-space point `p`, keeping the
 * frame's own aspect ratio and anchoring the opposite corner in place. The
 * dimension that moved further drives the size; the other is derived from
 * aspect so a diagonal drag never fights itself.
 */
export function resizeKeepingAspect(frame: Rect, corner: Corner, p: Point): Rect {
  const aspect = frame.w / frame.h
  const anchor: Point = {
    x: corner.includes('w') ? frame.x + frame.w : frame.x,
    y: corner.includes('n') ? frame.y + frame.h : frame.y,
  }

  let w = Math.abs(p.x - anchor.x)
  let h = Math.abs(p.y - anchor.y)
  if (w / aspect > h) h = w / aspect
  else w = h * aspect
  w = Math.max(MIN_SIZE, w)
  h = Math.max(MIN_SIZE, h)

  return {
    x: corner.includes('w') ? anchor.x - w : anchor.x,
    y: corner.includes('n') ? anchor.y - h : anchor.y,
    w,
    h,
  }
}
