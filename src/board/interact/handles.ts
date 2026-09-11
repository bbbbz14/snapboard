import type { BoardNode, NodeId } from '@/board/model/types'
import type { Point, Rect } from '@/lib/geometry'
import { boardToScreen, type Camera } from '@/board/view/camera'
import type { Corner } from './resize'

/** CSS-px size of a corner handle square, matched in BoardCanvas's draw code. */
export const HANDLE_SIZE = 6
/** Extra px of forgiveness around each handle's hitbox, easier than the visible square to hit. */
const HANDLE_TOLERANCE = 4

export const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

/** Board-space point of one corner of `frame`. */
export function cornerPoint(frame: Rect, corner: Corner): Point {
  return {
    x: corner.includes('w') ? frame.x : frame.x + frame.w,
    y: corner.includes('n') ? frame.y : frame.y + frame.h,
  }
}

/** Which selected node's resize handle (if any) sits under a screen-space point. */
export function hitTestHandle(
  nodes: BoardNode[],
  selectedIds: NodeId[],
  camera: Camera,
  viewport: { w: number; h: number },
  screenPoint: Point,
): { id: NodeId; corner: Corner; frame: Rect } | null {
  const reach = HANDLE_SIZE / 2 + HANDLE_TOLERANCE
  for (const n of nodes) {
    if (!selectedIds.includes(n.id)) continue
    for (const corner of CORNERS) {
      const p = boardToScreen(camera, viewport, cornerPoint(n.frame, corner))
      if (Math.abs(p.x - screenPoint.x) <= reach && Math.abs(p.y - screenPoint.y) <= reach) {
        return { id: n.id, corner, frame: n.frame }
      }
    }
  }
  return null
}
