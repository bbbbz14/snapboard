import { describe, it, expect } from 'vitest'
import { markerFrame } from '@/board/render/marker'
import { ANNOTATION_SIZE_RANGE } from '@/board/model/annotationDefaults'

const DIAMETER = ANNOTATION_SIZE_RANGE.marker.default

describe('markerFrame', () => {
  it('centers a square frame of the given diameter on the click point', () => {
    const frame = markerFrame({ x: 100, y: 50 }, DIAMETER)
    expect(frame.w).toBe(DIAMETER)
    expect(frame.h).toBe(DIAMETER)
    expect(frame.x + frame.w / 2).toBeCloseTo(100, 5)
    expect(frame.y + frame.h / 2).toBeCloseTo(50, 5)
  })

  it('honors a diameter other than the default', () => {
    const frame = markerFrame({ x: 0, y: 0 }, 64)
    expect(frame.w).toBe(64)
    expect(frame.h).toBe(64)
  })
})
