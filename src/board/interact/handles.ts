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

/**
 * Which corner of an arbitrary board-space rect (not necessarily a
 * `BoardNode`) sits under a screen-space point - the shared primitive behind
 * `hitTestHandle` below and the crop-window editor (`interact/crop.ts`'s
 * transient session rect isn't a node, so it can't go through that one).
 */
export function hitTestRectHandle(frame: Rect, camera: Camera, viewport: { w: number; h: number }, screenPoint: Point): Corner | null {
  const reach = HANDLE_SIZE / 2 + HANDLE_TOLERANCE
  for (const corner of CORNERS) {
    const p = boardToScreen(camera, viewport, cornerPoint(frame, corner))
    if (Math.abs(p.x - screenPoint.x) <= reach && Math.abs(p.y - screenPoint.y) <= reach) return corner
  }
  return null
}

/** Which selected node's resize handle (if any) sits under a screen-space point. */
export function hitTestHandle(
  nodes: BoardNode[],
  selectedIds: NodeId[],
  camera: Camera,
  viewport: { w: number; h: number },
  screenPoint: Point,
): { id: NodeId; corner: Corner; frame: Rect } | null {
  for (const n of nodes) {
    // Arrows have no aspect ratio to keep, and `resizeKeepingAspect` only
    // makes sense for images - dragging an arrow's selection corner moves it
    // instead (see BoardCanvas's onPointerDown falling through to `moveRef`).
    if (n.kind !== 'image') continue
    if (!selectedIds.includes(n.id)) continue
    const corner = hitTestRectHandle(n.frame, camera, viewport, screenPoint)
    if (corner) return { id: n.id, corner, frame: n.frame }
  }
  return null
}
