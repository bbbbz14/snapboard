import { describe, it, expect } from 'vitest'
import { MARKER_DIAMETER, markerFrame } from '@/board/render/marker'

describe('markerFrame', () => {
  it('centers a fixed-size square frame on the click point', () => {
    const frame = markerFrame({ x: 100, y: 50 })
    expect(frame.w).toBe(MARKER_DIAMETER)
    expect(frame.h).toBe(MARKER_DIAMETER)
    expect(frame.x + frame.w / 2).toBeCloseTo(100, 5)
    expect(frame.y + frame.h / 2).toBeCloseTo(50, 5)
  })
})
