import { describe, it, expect } from 'vitest'
import { CROP_MIN_SIZE, FULL_CROP, fullImageRect, resizeCropWindow, windowToCrop } from '@/board/interact/crop'

describe('fullImageRect', () => {
  it('returns the frame itself when the node is uncropped', () => {
    const frame = { x: 40, y: 20, w: 200, h: 100 }
    expect(fullImageRect(frame, FULL_CROP)).toEqual(frame)
  })

  it('expands to the full source image, anchored so the current crop lines up with `frame`', () => {
    // A crop that shows only the right half (x: 0.5..1) of a source image
    // whose full width is therefore twice the frame's.
    const frame = { x: 100, y: 100, w: 100, h: 100 }
    const crop = { x: 0.5, y: 0, w: 0.5, h: 1 }
    const bounds = fullImageRect(frame, crop)
    expect(bounds.w).toBeCloseTo(200, 5)
    expect(bounds.h).toBeCloseTo(100, 5)
    // The frame's own left edge sits at 50% into the full image.
    expect(bounds.x).toBeCloseTo(0, 5)
    expect(bounds.y).toBeCloseTo(100, 5)
  })
})

describe('resizeCropWindow', () => {
  const bounds = { x: 0, y: 0, w: 400, h: 300 }
  const win = { x: 50, y: 50, w: 200, h: 150 }

  it('shrinks from the se handle, anchoring the opposite (nw) corner', () => {
    const r = resizeCropWindow(win, 'se', { x: 150, y: 120 }, bounds)
    expect(r.x).toBe(50)
    expect(r.y).toBe(50)
    expect(r.w).toBeCloseTo(100, 5)
    expect(r.h).toBeCloseTo(70, 5)
  })

  it('grows from the nw handle towards the bounds, anchoring the opposite (se) corner', () => {
    const r = resizeCropWindow(win, 'nw', { x: 0, y: 0 }, bounds)
    expect(r.x + r.w).toBeCloseTo(250, 5)
    expect(r.y + r.h).toBeCloseTo(200, 5)
    expect(r.x).toBeCloseTo(0, 5)
    expect(r.y).toBeCloseTo(0, 5)
  })

  it('never drags past the full-image bounds', () => {
    const r = resizeCropWindow(win, 'se', { x: 10000, y: 10000 }, bounds)
    expect(r.x + r.w).toBeCloseTo(bounds.w, 5)
    expect(r.y + r.h).toBeCloseTo(bounds.h, 5)
  })

  it('never collapses below CROP_MIN_SIZE', () => {
    const r = resizeCropWindow(win, 'se', { x: 51, y: 51 }, bounds)
    expect(r.w).toBeGreaterThanOrEqual(CROP_MIN_SIZE)
    expect(r.h).toBeGreaterThanOrEqual(CROP_MIN_SIZE)
  })
})

describe('windowToCrop', () => {
  it('is the exact inverse of fullImageRect for an uncropped node', () => {
    const frame = { x: 40, y: 20, w: 200, h: 100 }
    const bounds = fullImageRect(frame, FULL_CROP)
    expect(windowToCrop(frame, bounds)).toEqual(FULL_CROP)
  })

  it('recovers a normalized crop rect for a window smaller than the full bounds', () => {
    const bounds = { x: 0, y: 0, w: 400, h: 200 }
    const win = { x: 100, y: 50, w: 200, h: 100 }
    const crop = windowToCrop(win, bounds)
    expect(crop).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
  })
})
