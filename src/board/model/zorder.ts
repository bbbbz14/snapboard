import type { NodeId } from './types'

/**
 * Moves the given ids to the end of the array (drawn last = on top, per
 * hitTest.ts's "highest order wins" and toRenderInput's paint order),
 * preserving their relative order among themselves and among what's left
 * behind. `nodes` must already be sorted into current z-order.
 */
export function moveToFront<T extends { id: NodeId }>(nodes: T[], ids: ReadonlySet<NodeId>): T[] {
  const rest = nodes.filter((n) => !ids.has(n.id))
  const selected = nodes.filter((n) => ids.has(n.id))
  return [...rest, ...selected]
}
