import type { Point, Rect } from '@/lib/geometry'
import { rectFromPoints } from '@/lib/geometry'
import type { Ctx2D } from './renderScene'

/** Extra board-space padding around the straight-line bounding box - a plain
 * stroke has no bow or arrowhead to cover (unlike `ArrowNode`'s own padding),
 * so this only needs to comfortably cover the stroke width at the tool's
 * largest setting. */
const LINE_HIT_PADDING = 10

/** A plain straight stroke with no arrowhead - used identically by
 * `renderScene` (board-space, the committed line) and `BoardCanvas`'s
 * interaction-canvas preview (screen-space, the in-progress drag), same
 * one-source-of-truth reasoning `strokeArrow`/`strokeBox` already
 * established. */
export function strokeLine(ctx: Ctx2D, start: Point, end: Point, color: string, lineWidth: number): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
  ctx.restore()
}

/** Bounding box used for hit-test/marquee/z-order - plain AABB padded enough
 * to cover the stroke width, not an exact line hit-test (same "no rotation,
 * plain rect math" simplicity `hitTest.ts`/`arrowFrame` already use). */
export function lineFrame(start: Point, end: Point): Rect {
  const r = rectFromPoints(start, end)
  return { x: r.x - LINE_HIT_PADDING, y: r.y - LINE_HIT_PADDING, w: r.w + LINE_HIT_PADDING * 2, h: r.h + LINE_HIT_PADDING * 2 }
}
