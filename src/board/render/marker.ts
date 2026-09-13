import type { Point, Rect } from '@/lib/geometry'
import type { Ctx2D } from './renderScene'

/** Centers a new marker's frame on the point the user clicked - unlike
 * arrow/box (dragged from two corners), a marker has no meaningful "size"
 * to draw, just a place to point, so placement is a single click. `diameter`
 * (board-space, see `ANNOTATION_SIZE_RANGE.marker`) becomes `frame.w`/`h`
 * directly - there is no separate stored size field for a marker, `frame`
 * already encodes it, same as `drawMarker` below deriving its radius from
 * `frame.w` rather than taking a size parameter of its own. */
export function markerFrame(point: Point, diameter: number): Rect {
  const r = diameter / 2
  return { x: point.x - r, y: point.y - r, w: diameter, h: diameter }
}

/** Same shape drawn on any 2D context - used identically by `renderScene`
 * (board-space, the committed marker) and `BoardCanvas`'s interaction-canvas
 * preview, same one-source-of-truth reasoning `strokeArrow`/`strokeBox`
 * already established. `number` is derived at render time from placement
 * order among markers only (see `toRenderInput`), not stored on the node -
 * the same "index among same-kind nodes" rule the existing per-image step
 * badges already use, so deleting one marker just renumbers the rest. */
export function drawMarker(ctx: Ctx2D, frame: Rect, number: number, color: string): void {
  const r = frame.w / 2
  const cx = frame.x + r
  const cy = frame.y + r

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  // A white ring keeps the marker legible sitting on top of arbitrary image
  // content, unlike the per-image step badge's background-matching ring -
  // a marker is placed over a photo, not next to it in the page background.
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${Math.round(frame.w * 0.5)}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(number), cx, cy + 1)
  ctx.restore()
}
