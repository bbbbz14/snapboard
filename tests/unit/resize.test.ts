import { describe, it, expect } from 'vitest'
import { resizeKeepingAspect } from '@/board/interact/resize'

describe('resizeKeepingAspect', () => {
  const frame = { x: 100, y: 100, w: 200, h: 100 } // 2:1 aspect

  it('grows from the se handle, anchoring the opposite (nw) corner', () => {
    const r = resizeKeepingAspect(frame, 'se', { x: 400, y: 150 })
    expect(r.x).toBe(100)
    expect(r.y).toBe(100)
    expect(r.w / r.h).toBeCloseTo(2, 5)
  })

  it('shrinks from the nw handle, anchoring the opposite (se) corner', () => {
    const r = resizeKeepingAspect(frame, 'nw', { x: 250, y: 175 })
    expect(r.x + r.w).toBeCloseTo(300, 5)
    expect(r.y + r.h).toBeCloseTo(200, 5)
    expect(r.w / r.h).toBeCloseTo(2, 5)
  })

  it('derives the smaller dimension from aspect when only one axis moves far', () => {
    // Pointer moves 200 in x but only 10 in y - x should drive the resize.
    const r = resizeKeepingAspect(frame, 'se', { x: 300, y: 110 })
    expect(r.w).toBeCloseTo(200, 5)
    expect(r.h).toBeCloseTo(100, 5)
  })

  it('never collapses to zero size', () => {
    const r = resizeKeepingAspect(frame, 'se', { x: 100, y: 100 })
    expect(r.w).toBeGreaterThan(0)
    expect(r.h).toBeGreaterThan(0)
  })
})
