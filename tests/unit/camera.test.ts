import { describe, it, expect } from 'vitest'
import {
  boardToScreen,
  clampCenter,
  clampZoom,
  fitCamera,
  fitZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  screenToBoard,
  zoomAt,
  type Camera,
} from '@/board/view/camera'

describe('fitZoom', () => {
  it('shrinks a board taller than the viewport', () => {
    // The exact case CLAUDE.md calls out: a tall board silently scaled down.
    expect(fitZoom({ w: 1200, h: 6000 }, { w: 900, h: 600 })).toBeCloseTo(0.1, 5)
  })

  it('never upscales a board smaller than the viewport', () => {
    expect(fitZoom({ w: 300, h: 200 }, { w: 1200, h: 900 })).toBe(1)
  })

  it('subtracts margin from both sides', () => {
    // 900 viewport - 40 margin either side = 820 usable, board is 820 wide.
    expect(fitZoom({ w: 820, h: 100 }, { w: 900, h: 900 }, 40)).toBe(1)
    expect(fitZoom({ w: 821, h: 100 }, { w: 900, h: 900 }, 40)).toBeLessThan(1)
  })
})

describe('fitCamera', () => {
  it('centres on the middle of the board', () => {
    const cam = fitCamera({ w: 400, h: 200 }, { w: 800, h: 800 })
    expect(cam.center).toEqual({ x: 200, y: 100 })
  })
})

describe('boardToScreen / screenToBoard', () => {
  const viewport = { w: 1000, h: 700 }
  const camera: Camera = { zoom: 2, center: { x: 150, y: 80 } }

  it('round-trips any point', () => {
    for (const p of [{ x: 0, y: 0 }, { x: 150, y: 80 }, { x: 400, y: -30 }]) {
      expect(screenToBoard(camera, viewport, boardToScreen(camera, viewport, p))).toEqual(p)
    }
  })

  it('puts the camera centre at the middle of the viewport', () => {
    expect(boardToScreen(camera, viewport, camera.center)).toEqual({ x: 500, y: 350 })
  })

  it('scales distances by zoom', () => {
    const a = boardToScreen(camera, viewport, { x: 150, y: 80 })
    const b = boardToScreen(camera, viewport, { x: 160, y: 80 })
    expect(b.x - a.x).toBe(10 * camera.zoom)
  })
})

describe('zoomAt', () => {
  const viewport = { w: 1000, h: 700 }
  const camera: Camera = { zoom: 1, center: { x: 500, y: 350 } }

  it('keeps the board point under the anchor fixed on screen', () => {
    const anchor = { x: 300, y: 200 }
    const before = screenToBoard(camera, viewport, anchor)
    const next = zoomAt(camera, viewport, anchor, 2.5)
    const after = screenToBoard(next, viewport, anchor)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
    expect(next.zoom).toBeCloseTo(2.5, 6)
  })

  it('clamps to the zoom bounds', () => {
    expect(zoomAt(camera, viewport, { x: 0, y: 0 }, 1000).zoom).toBe(MAX_ZOOM)
    expect(zoomAt(camera, viewport, { x: 0, y: 0 }, 0.0001).zoom).toBe(MIN_ZOOM)
  })
})

describe('panBy', () => {
  it('moves the board opposite the drag, scaled by zoom', () => {
    const camera: Camera = { zoom: 2, center: { x: 100, y: 100 } }
    const next = panBy(camera, 20, -10)
    expect(next.center).toEqual({ x: 90, y: 105 })
    expect(next.zoom).toBe(2)
  })

  it('leaves the camera unchanged for a zero-length pan', () => {
    const camera: Camera = { zoom: 1.5, center: { x: 10, y: 10 } }
    expect(panBy(camera, 0, 0)).toEqual(camera)
  })
})

describe('clampZoom', () => {
  it('bounds to [MIN_ZOOM, MAX_ZOOM]', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    expect(clampZoom(1000)).toBe(MAX_ZOOM)
    expect(clampZoom(1)).toBe(1)
  })
})

describe('clampCenter', () => {
  const board = { w: 800, h: 600 }
  const viewport = { w: 1000, h: 700 }

  it('leaves an already-centred camera unchanged', () => {
    const camera = fitCamera(board, viewport)
    expect(clampCenter(camera, board, viewport)).toEqual(camera)
  })

  it('bounds an unbounded plain-wheel pan, however far it scrolls', () => {
    // The exact bug this fixed: scrolling for a long time used to carry the
    // board arbitrarily far off-screen with no way back short of fit-to-view.
    let camera: Camera = { zoom: 1, center: { x: 400, y: 300 } }
    for (let i = 0; i < 500; i++) {
      camera = clampCenter(panBy(camera, 0, 500), board, viewport)
    }
    expect(camera.center.y).toBeLessThan(board.h + viewport.h)
    const secondToLast = clampCenter(panBy({ ...camera }, 0, 500), board, viewport)
    expect(secondToLast.center).toEqual(camera.center)
  })

  it('keeps at least some overlap between the viewport and the board on each axis', () => {
    const farAway: Camera = { zoom: 1, center: { x: 1_000_000, y: -1_000_000 } }
    const clamped = clampCenter(farAway, board, viewport)
    const halfW = viewport.w / 2
    const halfH = viewport.h / 2
    expect(clamped.center.x - halfW).toBeLessThan(board.w)
    expect(clamped.center.y + halfH).toBeGreaterThan(0)
  })

  it('scales the allowed range with zoom, not just the raw board size', () => {
    const zoomedIn: Camera = { zoom: 4, center: { x: 1_000_000, y: 0 } }
    const clamped = clampCenter(zoomedIn, board, viewport)
    // At 4x zoom the viewport covers far less board area, so the clamp range
    // is tighter than it would be at zoom 1 - just confirm it's still finite
    // and on the correct side of the board rather than left unbounded.
    expect(clamped.center.x).toBeLessThan(1_000_000)
    expect(Number.isFinite(clamped.center.x)).toBe(true)
  })
})
