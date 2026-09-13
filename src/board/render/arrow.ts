import type { Point, Rect } from '@/lib/geometry'
import { rectFromPoints } from '@/lib/geometry'
import type { Ctx2D } from './renderScene'

/** Extra board-space padding around the straight-line bounding box, wide
 * enough to cover the curve's bow and the arrowhead - see `arrowFrame`. */
const ARROW_HIT_PADDING = 16

const ARROWHEAD_LENGTH = 14
const ARROWHEAD_ANGLE = Math.PI / 7

export interface ArrowGeometry {
  ctrl: Point
  headLeft: Point
  headRight: Point
}

/**
 * A single control point offset perpendicular to the line, so the arrow
 * bows slightly instead of being a rigid straight line (product plan:
 * "ลูกศร โค้งเล็กน้อย ดูเป็นมิตร"). The arrowhead's angle comes from the
 * curve's tangent at `end` (direction from `ctrl` to `end`), not from
 * `start` to `end` - otherwise it visibly points off the curve.
 */
export function arrowGeometry(start: Point, end: Point): ArrowGeometry {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy) || 1
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  const normal = { x: -dy / len, y: dx / len }
  const bow = Math.min(40, Math.max(4, len * 0.12))
  const ctrl = { x: mid.x + normal.x * bow, y: mid.y + normal.y * bow }

  const tx = end.x - ctrl.x
  const ty = end.y - ctrl.y
  const angle = Math.atan2(ty, tx)
  const headLen = Math.min(ARROWHEAD_LENGTH, len * 0.6)
  const headLeft = {
    x: end.x - headLen * Math.cos(angle - ARROWHEAD_ANGLE),
    y: end.y - headLen * Math.sin(angle - ARROWHEAD_ANGLE),
  }
  const headRight = {
    x: end.x - headLen * Math.cos(angle + ARROWHEAD_ANGLE),
    y: end.y - headLen * Math.sin(angle + ARROWHEAD_ANGLE),
  }
  return { ctrl, headLeft, headRight }
}

/** Same geometry, drawn on any 2D context - used identically by `renderScene`
 * (board-space, real arrows) and `BoardCanvas`'s interaction overlay
 * (screen-space, the in-progress preview) so the two can never drift apart. */
export function strokeArrow(ctx: Ctx2D, start: Point, end: Point, color: string, lineWidth: number): void {
  const { ctrl, headLeft, headRight } = arrowGeometry(start, end)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(headLeft.x, headLeft.y)
  ctx.lineTo(end.x, end.y)
  ctx.lineTo(headRight.x, headRight.y)
  ctx.stroke()
  ctx.restore()
}

/** Bounding box used for hit-test/marquee/z-order - plain AABB padded enough
 * to cover the curve's bow and the arrowhead, not an exact curve hit-test
 * (same "no rotation, plain rect math" simplicity `hitTest.ts` already uses
 * for image frames). */
export function arrowFrame(start: Point, end: Point): Rect {
  const r = rectFromPoints(start, end)
  return { x: r.x - ARROW_HIT_PADDING, y: r.y - ARROW_HIT_PADDING, w: r.w + ARROW_HIT_PADDING * 2, h: r.h + ARROW_HIT_PADDING * 2 }
}
