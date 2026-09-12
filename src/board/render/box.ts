import type { Rect } from '@/lib/geometry'
import type { Ctx2D } from './renderScene'

/** Board-space stroke width; scales with preview zoom/export scale via the
 * caller's canvas transform, same as `ARROW_STROKE_WIDTH`. */
export const BOX_STROKE_WIDTH = 3

/** Same shape drawn on any 2D context - used identically by `renderScene`
 * (board-space, the committed box) and `BoardCanvas`'s interaction overlay
 * (screen-space, the in-progress preview), so the two can never drift apart -
 * same "one source of truth" reasoning `strokeArrow` already established. */
export function strokeBox(ctx: Ctx2D, frame: Rect, color: string, lineWidth: number): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.strokeRect(frame.x, frame.y, frame.w, frame.h)
  ctx.restore()
}
