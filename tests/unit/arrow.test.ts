import { describe, it, expect } from 'vitest'
import { arrowFrame, arrowGeometry } from '@/board/render/arrow'

describe('arrowGeometry', () => {
  it('bows the control point off the straight line, not on it', () => {
    const { ctrl } = arrowGeometry({ x: 0, y: 0 }, { x: 100, y: 0 })
    // On a horizontal line the midpoint is (50, 0) - a friendly curve must
    // push the control point off that axis, or it would render as a
    // perfectly straight segment.
    expect(ctrl.x).toBeCloseTo(50, 5)
    expect(Math.abs(ctrl.y)).toBeGreaterThan(0)
  })

  it('points the arrowhead along the curve, not the straight start-to-end line', () => {
    const { headLeft, headRight, ctrl } = arrowGeometry({ x: 0, y: 0 }, { x: 100, y: 0 })
    const end = { x: 100, y: 0 }
    // The head's own tangent direction (end - ctrl) is what the wings are
    // built from, so both wings must sit on the ctrl->end side, not
    // symmetric around the raw start->end line whenever ctrl.y !== 0.
    const tangentAngle = Math.atan2(end.y - ctrl.y, end.x - ctrl.x)
    const naiveAngle = Math.atan2(0, 100)
    expect(tangentAngle).not.toBeCloseTo(naiveAngle, 2)
    expect(headLeft.x).toBeLessThan(end.x)
    expect(headRight.x).toBeLessThan(end.x)
  })

  it('keeps a tiny bow for a very short drag instead of a huge or negative one', () => {
    const { ctrl } = arrowGeometry({ x: 0, y: 0 }, { x: 2, y: 0 })
    expect(Math.abs(ctrl.y)).toBeGreaterThanOrEqual(4)
    expect(Math.abs(ctrl.y)).toBeLessThanOrEqual(40)
  })
})

describe('arrowFrame', () => {
  it('produces a padded bounding box around both endpoints', () => {
    const frame = arrowFrame({ x: 10, y: 10 }, { x: 50, y: 30 })
    expect(frame.x).toBeLessThan(10)
    expect(frame.y).toBeLessThan(10)
    expect(frame.x + frame.w).toBeGreaterThan(50)
    expect(frame.y + frame.h).toBeGreaterThan(30)
  })

  it('is order-independent (start/end swapped gives the same box)', () => {
    const a = arrowFrame({ x: 10, y: 10 }, { x: 50, y: 30 })
    const b = arrowFrame({ x: 50, y: 30 }, { x: 10, y: 10 })
    expect(a).toEqual(b)
  })
})
