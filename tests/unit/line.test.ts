import { describe, it, expect } from 'vitest'
import { lineFrame } from '@/board/render/line'

describe('lineFrame', () => {
  it('produces a padded bounding box around both endpoints', () => {
    const frame = lineFrame({ x: 10, y: 10 }, { x: 50, y: 30 })
    expect(frame.x).toBeLessThan(10)
    expect(frame.y).toBeLessThan(10)
    expect(frame.x + frame.w).toBeGreaterThan(50)
    expect(frame.y + frame.h).toBeGreaterThan(30)
  })

  it('is order-independent (start/end swapped gives the same box)', () => {
    const a = lineFrame({ x: 10, y: 10 }, { x: 50, y: 30 })
    const b = lineFrame({ x: 50, y: 30 }, { x: 10, y: 10 })
    expect(a).toEqual(b)
  })
})
