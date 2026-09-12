import { describe, it, expect } from 'vitest'
import { containsPoint, hitTest, intersectsRect, marqueeSelect } from '@/board/interact/hitTest'
import type { ArrowNode, BoxNode, ImageNode, MarkerNode, TextNode } from '@/board/model/types'

function node(id: string, frame: { x: number; y: number; w: number; h: number }, order: number): ImageNode {
  return { kind: 'image', id, assetId: `a-${id}`, frame, order }
}

function arrow(id: string, frame: { x: number; y: number; w: number; h: number }, order: number): ArrowNode {
  return { kind: 'arrow', id, frame, order, start: { x: frame.x, y: frame.y }, end: { x: frame.x + frame.w, y: frame.y + frame.h }, color: '#dc2626' }
}

function box(id: string, frame: { x: number; y: number; w: number; h: number }, order: number): BoxNode {
  return { kind: 'box', id, frame, order, color: '#dc2626' }
}

function text(id: string, frame: { x: number; y: number; w: number; h: number }, order: number): TextNode {
  return { kind: 'text', id, frame, order, text: 'hi', color: '#dc2626' }
}

function marker(id: string, frame: { x: number; y: number; w: number; h: number }, order: number): MarkerNode {
  return { kind: 'marker', id, frame, order, color: '#dc2626' }
}

describe('containsPoint', () => {
  it('is true inside and on the edge of the rect', () => {
    const r = { x: 0, y: 0, w: 10, h: 10 }
    expect(containsPoint(r, { x: 5, y: 5 })).toBe(true)
    expect(containsPoint(r, { x: 0, y: 0 })).toBe(true)
    expect(containsPoint(r, { x: 10, y: 10 })).toBe(true)
  })

  it('is false outside the rect', () => {
    expect(containsPoint({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 5 })).toBe(false)
  })
})

describe('intersectsRect', () => {
  it('is true for overlapping rects', () => {
    expect(intersectsRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
  })

  it('is false for disjoint rects', () => {
    expect(intersectsRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(false)
  })

  it('is false for rects that only touch at an edge', () => {
    expect(intersectsRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false)
  })
})

describe('hitTest', () => {
  it('returns null when nothing is under the point', () => {
    const nodes = [node('a', { x: 0, y: 0, w: 10, h: 10 }, 0)]
    expect(hitTest(nodes, { x: 50, y: 50 })).toBeNull()
  })

  it('returns the single node under the point', () => {
    const nodes = [node('a', { x: 0, y: 0, w: 10, h: 10 }, 0)]
    expect(hitTest(nodes, { x: 5, y: 5 })).toBe('a')
  })

  it('returns the topmost (highest order) node when frames overlap', () => {
    const nodes = [node('back', { x: 0, y: 0, w: 20, h: 20 }, 0), node('front', { x: 0, y: 0, w: 20, h: 20 }, 1)]
    expect(hitTest(nodes, { x: 5, y: 5 })).toBe('front')
  })

  it('is generic across node kinds - an arrow hits like any other frame', () => {
    const nodes: (ImageNode | ArrowNode)[] = [
      node('img', { x: 0, y: 0, w: 20, h: 20 }, 0),
      arrow('arr', { x: 0, y: 0, w: 20, h: 20 }, 1),
    ]
    expect(hitTest(nodes, { x: 5, y: 5 })).toBe('arr')
  })

  it('is generic across node kinds - a box hits like any other frame', () => {
    const nodes: (ImageNode | BoxNode)[] = [
      node('img', { x: 0, y: 0, w: 20, h: 20 }, 0),
      box('bx', { x: 0, y: 0, w: 20, h: 20 }, 1),
    ]
    expect(hitTest(nodes, { x: 5, y: 5 })).toBe('bx')
  })

  it('is generic across node kinds - a text node hits like any other frame', () => {
    const nodes: (ImageNode | TextNode)[] = [
      node('img', { x: 0, y: 0, w: 20, h: 20 }, 0),
      text('txt', { x: 0, y: 0, w: 20, h: 20 }, 1),
    ]
    expect(hitTest(nodes, { x: 5, y: 5 })).toBe('txt')
  })

  it('is generic across node kinds - a marker hits like any other frame', () => {
    const nodes: (ImageNode | MarkerNode)[] = [
      node('img', { x: 0, y: 0, w: 20, h: 20 }, 0),
      marker('mk', { x: 0, y: 0, w: 20, h: 20 }, 1),
    ]
    expect(hitTest(nodes, { x: 5, y: 5 })).toBe('mk')
  })
})

describe('marqueeSelect', () => {
  it('returns ids of every node the marquee intersects, in z-order', () => {
    const nodes = [
      node('c', { x: 100, y: 100, w: 10, h: 10 }, 2),
      node('a', { x: 0, y: 0, w: 10, h: 10 }, 0),
      node('b', { x: 5, y: 5, w: 10, h: 10 }, 1),
    ]
    expect(marqueeSelect(nodes, { x: 0, y: 0, w: 12, h: 12 })).toEqual(['a', 'b'])
  })

  it('returns an empty array when the marquee hits nothing', () => {
    const nodes = [node('a', { x: 0, y: 0, w: 10, h: 10 }, 0)]
    expect(marqueeSelect(nodes, { x: 100, y: 100, w: 10, h: 10 })).toEqual([])
  })
})
