import type { Point, Rect } from '@/lib/geometry'
import type { BoardNode, NodeId } from '@/board/model/types'

export function containsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

export function intersectsRect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Id of the topmost node (highest `order`) whose frame contains `p`, or null.
 * Frames have no rotation (see model/types.ts), so this is plain AABB math.
 */
export function hitTest(nodes: BoardNode[], p: Point): NodeId | null {
  let best: BoardNode | null = null
  for (const n of nodes) {
    if (containsPoint(n.frame, p) && (!best || n.order > best.order)) best = n
  }
  return best?.id ?? null
}

/** Ids of every node whose frame intersects `marquee`, in the board's z-order. */
export function marqueeSelect(nodes: BoardNode[], marquee: Rect): NodeId[] {
  return [...nodes]
    .sort((a, b) => a.order - b.order)
    .filter((n) => intersectsRect(n.frame, marquee))
    .map((n) => n.id)
}
