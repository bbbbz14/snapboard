import { describe, it, expect } from 'vitest'
import { snapMove } from '@/board/interact/snap'

describe('snapMove', () => {
  const board = { w: 1000, h: 800 }

  it('snaps to another node\'s left edge within the threshold', () => {
    const moving = { x: 203, y: 50, w: 100, h: 100 }
    const other = { x: 200, y: 300, w: 100, h: 100 }
    const r = snapMove(moving, [other], board, 8)
    expect(r.dx).toBeCloseTo(-3, 5)
    expect(r.guides).toEqual([{ axis: 'x', at: 200 }])
  })

  it('snaps to the board center', () => {
    // Center of a 100-wide node at x=445 is 495, 5px off board center 500.
    const moving = { x: 445, y: 50, w: 100, h: 100 }
    const r = snapMove(moving, [], board, 8)
    expect(r.dx).toBeCloseTo(5, 5)
    expect(r.guides).toEqual([{ axis: 'x', at: 500 }])
  })

  it('does not snap when nothing is within the threshold', () => {
    const moving = { x: 50, y: 50, w: 20, h: 20 }
    const other = { x: 500, y: 500, w: 20, h: 20 }
    const r = snapMove(moving, [other], board, 8)
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(0)
    expect(r.guides).toEqual([])
  })

  it('snaps independently on each axis', () => {
    const moving = { x: 203, y: 297, w: 100, h: 100 }
    const other = { x: 200, y: 300, w: 100, h: 100 }
    const r = snapMove(moving, [other], board, 8)
    expect(r.dx).toBeCloseTo(-3, 5)
    expect(r.dy).toBeCloseTo(3, 5)
    expect(r.guides).toHaveLength(2)
  })
})
