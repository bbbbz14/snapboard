import { describe, it, expect, beforeEach } from 'vitest'
import { toRenderInput, useBoardStore } from '@/board/store/boardStore'
import { DEFAULT_BOARD, type ImageNode } from '@/board/model/types'

function node(id: string, frame: { x: number; y: number; w: number; h: number }): ImageNode {
  return { kind: 'image', id, assetId: `a-${id}`, frame, order: 0 }
}

function stepNode(id: string, order: number): ImageNode {
  return { kind: 'image', id, assetId: `a-${id}`, frame: { x: 0, y: 0, w: 16, h: 9 }, order }
}

describe('setFrames', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('n0', { x: 0, y: 0, w: 10, h: 10 })] },
    })
  })

  it('commits the new frame and switches layout to free', () => {
    useBoardStore.getState().setFrames([{ id: 'n0', frame: { x: 5, y: 5, w: 10, h: 10 } }])
    const board = useBoardStore.getState().board
    expect(board.layout).toBe('free')
    expect(board.nodes[0]?.frame).toEqual({ x: 5, y: 5, w: 10, h: 10 })
  })

  it('leaves other actions unable to recompute frames once free (invariant 4)', () => {
    useBoardStore.getState().setFrames([{ id: 'n0', frame: { x: 5, y: 5, w: 10, h: 10 } }])
    useBoardStore.getState().setGap(40)
    expect(useBoardStore.getState().board.nodes[0]?.frame).toEqual({ x: 5, y: 5, w: 10, h: 10 })
  })
})

describe('reorder', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'steps', nodes: [stepNode('a', 0), stepNode('b', 1), stepNode('c', 2)] },
    })
  })

  it('moves the node to the target index and reindexes the rest', () => {
    useBoardStore.getState().reorder('c', 0)
    const order = [...useBoardStore.getState().board.nodes].sort((a, b) => a.order - b.order).map((n) => n.id)
    expect(order).toEqual(['c', 'a', 'b'])
  })

  it('renumbers step badges to match the new order', () => {
    useBoardStore.getState().reorder('c', 0)
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.items.map((i) => i.id)).toEqual(['c', 'a', 'b'])
    expect(input.items.map((i) => i.badge)).toEqual([1, 2, 3])
  })

  it('does not switch away from the current auto mode (unlike setFrames)', () => {
    useBoardStore.getState().reorder('c', 0)
    expect(useBoardStore.getState().board.layout).toBe('steps')
  })
})

describe('deleteSelected', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'steps', nodes: [stepNode('a', 0), stepNode('b', 1), stepNode('c', 2)] },
      selectedIds: ['b'],
    })
  })

  it('removes the selected nodes and clears the selection', () => {
    useBoardStore.getState().deleteSelected()
    const board = useBoardStore.getState().board
    expect(board.nodes.map((n) => n.id)).toEqual(['a', 'c'])
    expect(useBoardStore.getState().selectedIds).toEqual([])
  })

  it('renumbers step badges to close the gap', () => {
    useBoardStore.getState().deleteSelected()
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.items.map((i) => i.id)).toEqual(['a', 'c'])
    expect(input.items.map((i) => i.badge)).toEqual([1, 2])
  })

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ selectedIds: [] })
    useBoardStore.getState().deleteSelected()
    expect(useBoardStore.getState().board.nodes).toHaveLength(3)
  })
})

describe('duplicateSelected', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'free', nodes: [node('orig', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: ['orig'],
    })
  })

  it('adds a copy right after the original and selects it', () => {
    useBoardStore.getState().duplicateSelected()
    const board = useBoardStore.getState().board
    expect(board.nodes).toHaveLength(2)
    expect(board.nodes[0]?.id).toBe('orig')
    const copy = board.nodes[1]!
    expect(copy.id).not.toBe('orig')
    expect(useBoardStore.getState().selectedIds).toEqual([copy.id])
  })

  it('offsets the copy so it is not stacked exactly on the original', () => {
    useBoardStore.getState().duplicateSelected()
    const [original, copy] = useBoardStore.getState().board.nodes
    expect(copy!.frame.x).toBeGreaterThan(original!.frame.x)
    expect(copy!.frame.y).toBeGreaterThan(original!.frame.y)
  })

  it('does not touch layout (stays free, invariant 4)', () => {
    useBoardStore.getState().duplicateSelected()
    expect(useBoardStore.getState().board.layout).toBe('free')
  })
})

describe('bringToFront', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'free', nodes: [stepNode('a', 0), stepNode('b', 1), stepNode('c', 2)] },
      selectedIds: ['a'],
    })
  })

  it('moves the selected node to the end of z-order', () => {
    useBoardStore.getState().bringToFront()
    const order = [...useBoardStore.getState().board.nodes].sort((a, b) => a.order - b.order).map((n) => n.id)
    expect(order).toEqual(['b', 'c', 'a'])
  })

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ selectedIds: [] })
    useBoardStore.getState().bringToFront()
    const order = [...useBoardStore.getState().board.nodes].sort((a, b) => a.order - b.order).map((n) => n.id)
    expect(order).toEqual(['a', 'b', 'c'])
  })
})
