import type { Rect } from '@/lib/geometry'
import type { Ctx2D } from './renderScene'

/** Fixed, fully-opaque - a redaction must actually remove the pixels
 * underneath, not just tint them, so there is no opacity/color option here
 * (see `RedactNode`'s own note on why that's a deliberate scope cut). */
export const REDACT_FILL_COLOR = '#000000'

/** Same shape drawn on any 2D context - used identically by `renderScene`
 * (board-space, the committed redaction) and `BoardCanvas`'s interaction-
 * canvas preview (screen-space, while dragging), same one-source-of-truth
 * reasoning `strokeBox`/`strokeArrow` already established. Because the fill
 * is fully opaque, the preview while dragging already looks exactly like
 * the final, exported result - there is nothing to reveal later. */
export function fillRedact(ctx: Ctx2D, frame: Rect): void {
  ctx.save()
  ctx.fillStyle = REDACT_FILL_COLOR
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h)
  ctx.restore()
}
