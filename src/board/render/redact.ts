import type { Rect } from '@/lib/geometry'
import type { Ctx2D } from './renderScene'

/** Redact's own default - deliberately pure black, not `DEFAULT_ANNOTATION_COLOR`
 * (red) and not the 7-swatch palette's "black" (`#111827`, a dark navy-gray
 * chosen for on-screen contrast, not for being literally `#000`). A redaction
 * a user hasn't touched the color picker for must stay exactly opaque black -
 * `tests/e2e/redact.spec.ts` reads back the exported pixel and checks it
 * against `[0, 0, 0, 255]` as unambiguous proof the covered content is gone,
 * and that check must keep working whether or not this feature exists. */
export const REDACT_DEFAULT_COLOR = '#000000'

/** Same shape drawn on any 2D context - used identically by `renderScene`
 * (board-space, the committed redaction) and `BoardCanvas`'s interaction-
 * canvas preview (screen-space, while dragging), same one-source-of-truth
 * reasoning `strokeBox`/`strokeArrow` already established. `color` is always
 * fully opaque - a redaction must actually remove the pixels underneath,
 * not just tint them, so there is still no opacity dial (see `RedactNode`'s
 * own note) - so the preview while dragging already looks exactly like the
 * final, exported result, there is nothing to reveal later. */
export function fillRedact(ctx: Ctx2D, frame: Rect, color: string): void {
  ctx.save()
  ctx.fillStyle = color
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h)
  ctx.restore()
}
