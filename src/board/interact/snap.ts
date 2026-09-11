import type { Rect } from '@/lib/geometry'

export interface SnapGuide {
  axis: 'x' | 'y'
  at: number
}

export interface SnapResult {
  dx: number
  dy: number
  guides: SnapGuide[]
}

const xTargets = (r: Rect): number[] => [r.x, r.x + r.w / 2, r.x + r.w]
const yTargets = (r: Rect): number[] => [r.y, r.y + r.h / 2, r.y + r.h]

/**
 * Nudges `frame` onto the nearest edge/center of `others` or the board
 * bounds, independently on each axis, within `threshold` board units.
 * Returns the delta to apply on top of the pointer's own movement, plus the
 * guide line(s) to draw when a snap is in effect.
 */
export function snapMove(frame: Rect, others: Rect[], board: { w: number; h: number }, threshold: number): SnapResult {
  const targetsX = [0, board.w / 2, board.w, ...others.flatMap(xTargets)]
  const targetsY = [0, board.h / 2, board.h, ...others.flatMap(yTargets)]

  let dx = 0
  let bestX = threshold
  let guideX: number | null = null
  for (const mx of xTargets(frame)) {
    for (const tx of targetsX) {
      const d = tx - mx
      if (Math.abs(d) < bestX) {
        bestX = Math.abs(d)
        dx = d
        guideX = tx
      }
    }
  }

  let dy = 0
  let bestY = threshold
  let guideY: number | null = null
  for (const my of yTargets(frame)) {
    for (const ty of targetsY) {
      const d = ty - my
      if (Math.abs(d) < bestY) {
        bestY = Math.abs(d)
        dy = d
        guideY = ty
      }
    }
  }

  const guides: SnapGuide[] = []
  if (guideX !== null) guides.push({ axis: 'x', at: guideX })
  if (guideY !== null) guides.push({ axis: 'y', at: guideY })
  return { dx: guideX !== null ? dx : 0, dy: guideY !== null ? dy : 0, guides }
}
