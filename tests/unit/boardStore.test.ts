import { describe, it, expect, beforeEach } from 'vitest'
import { toRenderInput, useBoardStore } from '@/board/store/boardStore'
import { DEFAULT_BOARD, type ImageNode } from '@/board/model/types'
import { ANNOTATION_SIZE_RANGE, DEFAULT_ANNOTATION_COLOR } from '@/board/model/annotationDefaults'
import { REDACT_DEFAULT_COLOR } from '@/board/render/redact'

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

  it('commits the new frame, switches layout to free, and fits the board tightly to it', () => {
    useBoardStore.getState().setFrames([{ id: 'n0', frame: { x: 5, y: 5, w: 10, h: 10 } }])
    const board = useBoardStore.getState().board
    expect(board.layout).toBe('free')
    // With a single node, the tight-fit (fitBoardToContent) recenters it to sit
    // exactly `padding` from the edge rather than leaving it at the literal
    // coordinates just committed - see the note on fitBoardToContent.
    expect(board.nodes[0]?.frame).toEqual({ x: board.padding, y: board.padding, w: 10, h: 10 })
    expect(board.size).toEqual({ w: 10 + board.padding * 2, h: 10 + board.padding * 2 })
  })

  it('leaves other actions unable to recompute frames once free (invariant 4)', () => {
    useBoardStore.getState().setFrames([{ id: 'n0', frame: { x: 5, y: 5, w: 10, h: 10 } }])
    const fitted = useBoardStore.getState().board.nodes[0]?.frame
    useBoardStore.getState().setGap(40)
    expect(useBoardStore.getState().board.nodes[0]?.frame).toEqual(fitted)
  })
})

describe('setFrames auto-fit (fitBoardToContent)', () => {
  it('shrinks the board once a manual rearrange makes the content bounding box smaller', () => {
    // Two nodes stacked vertically - moving the second one up next to the
    // first collapses the bounding box height, the exact shape of the bug
    // report this closes: auto-layout produced a tall board (e.g. two rows),
    // the user rearranged into one short row by hand, and the canvas used to
    // stay frozen at the old, taller size (invariant 4 only protects frames,
    // not size) - leaving dead margin in every export/copy.
    useBoardStore.setState({
      board: {
        ...DEFAULT_BOARD,
        layout: 'auto',
        padding: 10,
        nodes: [node('n0', { x: 10, y: 10, w: 100, h: 50 }), node('n1', { x: 10, y: 70, w: 100, h: 50 })],
      },
    })
    useBoardStore.getState().setFrames([{ id: 'n1', frame: { x: 120, y: 10, w: 100, h: 50 } }])
    const board = useBoardStore.getState().board
    expect(board.size).toEqual({ w: 230, h: 70 })
    expect(board.nodes.map((n) => n.frame)).toEqual([
      { x: 10, y: 10, w: 100, h: 50 },
      { x: 120, y: 10, w: 100, h: 50 },
    ])
  })

  it('is a no-op when the move does not change the bounding box (the common case)', () => {
    useBoardStore.setState({
      board: {
        ...DEFAULT_BOARD,
        layout: 'auto',
        padding: 10,
        size: { w: 240, h: 70 }, // already fitted to the bounds n0/n1 form below
        nodes: [
          node('n0', { x: 10, y: 10, w: 100, h: 50 }),
          node('n1', { x: 130, y: 10, w: 100, h: 50 }),
          node('n2', { x: 50, y: 20, w: 20, h: 20 }),
        ],
      },
    })
    const before = useBoardStore.getState().board.size
    // n2 sits well inside the bounding box n0/n1 form - nudging it doesn't
    // touch that box's own min/max edges, so nothing should resize.
    useBoardStore.getState().setFrames([{ id: 'n2', frame: { x: 55, y: 25, w: 20, h: 20 } }])
    expect(useBoardStore.getState().board.size).toEqual(before)
  })
})

describe('commitCrop', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('n0', { x: 0, y: 0, w: 100, h: 100 })] },
      selectedIds: ['n0'],
    })
  })

  it('sets both frame and crop, and switches layout to free (same manual-edit rule as setFrames)', () => {
    useBoardStore.getState().commitCrop('n0', { x: 10, y: 10, w: 40, h: 40 }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
    const board = useBoardStore.getState().board
    const n = board.nodes.find((x) => x.id === 'n0')
    expect(board.layout).toBe('free')
    expect(n?.frame).toEqual({ x: 10, y: 10, w: 40, h: 40 })
    expect(n?.kind).toBe('image')
    expect((n as ImageNode).crop).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
  })

  it('leaves the crop untouched by a later relayout, same as invariant 4 protects any other manual edit', () => {
    useBoardStore.getState().commitCrop('n0', { x: 10, y: 10, w: 40, h: 40 }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
    useBoardStore.getState().setGap(40)
    const n = useBoardStore.getState().board.nodes.find((x) => x.id === 'n0') as ImageNode
    expect(n.frame).toEqual({ x: 10, y: 10, w: 40, h: 40 })
    expect(n.crop).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
  })

  it('does not disturb the selection', () => {
    useBoardStore.getState().commitCrop('n0', { x: 10, y: 10, w: 40, h: 40 }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
    expect(useBoardStore.getState().selectedIds).toEqual(['n0'])
  })

  it('can be undone, restoring the pre-crop frame and dropping the crop field', () => {
    useBoardStore.getState().commitCrop('n0', { x: 10, y: 10, w: 40, h: 40 }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
    useBoardStore.getState().undo()
    const n = useBoardStore.getState().board.nodes.find((x) => x.id === 'n0') as ImageNode
    expect(n.frame).toEqual({ x: 0, y: 0, w: 100, h: 100 })
    expect(n.crop).toBeUndefined()
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

describe('addArrow', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('img', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: [],
      tool: 'arrow',
    })
  })

  it('adds an arrow node, selects it, leaves layout untouched, and returns to the select tool', () => {
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const board = useBoardStore.getState().board
    const arrow = board.nodes.find((n) => n.kind === 'arrow')
    expect(arrow).toBeDefined()
    expect(arrow).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 40, y: 0 } })
    expect(board.layout).toBe('auto')
    expect(useBoardStore.getState().selectedIds).toEqual([arrow!.id])
    expect(useBoardStore.getState().tool).toBe('select')
  })

  it('does not disturb the existing image node', () => {
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const board = useBoardStore.getState().board
    expect(board.nodes.find((n) => n.id === 'img')?.frame).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })

  it('moving an arrow (setFrames) translates its start/end, not just the bounding frame', () => {
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const arrow = useBoardStore.getState().board.nodes.find((n) => n.kind === 'arrow')!
    useBoardStore.getState().setFrames([{ id: arrow.id, frame: { ...arrow.frame, x: arrow.frame.x + 100, y: arrow.frame.y + 5 } }])
    const board = useBoardStore.getState().board
    const moved = board.nodes.find((n) => n.id === arrow.id)
    // setFrames also fits the board tightly to content (fitBoardToContent),
    // which uniformly shifts every node - read the shift off the untouched
    // image node rather than hardcoding it.
    const img = board.nodes.find((n) => n.id === 'img')!
    expect(moved).toMatchObject({
      start: { x: 100 + img.frame.x, y: 5 + img.frame.y },
      end: { x: 140 + img.frame.x, y: 5 + img.frame.y },
    })
  })

  it('duplicating an arrow offsets its start/end along with the frame', () => {
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const arrow = useBoardStore.getState().board.nodes.find((n) => n.kind === 'arrow')!
    useBoardStore.setState({ selectedIds: [arrow.id] })
    useBoardStore.getState().duplicateSelected()
    const copyId = useBoardStore.getState().selectedIds[0]!
    const copy = useBoardStore.getState().board.nodes.find((n) => n.id === copyId)
    expect(copy).toMatchObject({ start: { x: 16, y: 16 }, end: { x: 56, y: 16 } })
  })

  it('is excluded from toRenderInput.items and step badge numbering, and appears in .arrows', () => {
    useBoardStore.setState({ board: { ...useBoardStore.getState().board, layout: 'steps', resolvedLayout: 'steps' } })
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.items.map((i) => i.id)).toEqual(['img'])
    expect(input.items[0]?.badge).toBe(1)
    expect(input.arrows).toHaveLength(1)
    expect(input.arrows![0]).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 40, y: 0 } })
  })

  it('can be deleted and undone like any other node', () => {
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const arrowId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'arrow')!.id
    useBoardStore.setState({ selectedIds: [arrowId] })
    useBoardStore.getState().deleteSelected()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === arrowId)).toBeUndefined()

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === arrowId)).toBeDefined()
  })
})

describe('addLine', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('img', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: [],
      tool: 'line',
    })
  })

  it('adds a line node, selects it, leaves layout untouched, and returns to the select tool', () => {
    useBoardStore.getState().addLine({ x: 0, y: 0 }, { x: 40, y: 0 })
    const board = useBoardStore.getState().board
    const line = board.nodes.find((n) => n.kind === 'line')
    expect(line).toBeDefined()
    expect(line).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 40, y: 0 } })
    expect(board.layout).toBe('auto')
    expect(useBoardStore.getState().selectedIds).toEqual([line!.id])
    expect(useBoardStore.getState().tool).toBe('select')
  })

  it('does not disturb the existing image node', () => {
    useBoardStore.getState().addLine({ x: 0, y: 0 }, { x: 40, y: 0 })
    const board = useBoardStore.getState().board
    expect(board.nodes.find((n) => n.id === 'img')?.frame).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })

  it('moving a line (setFrames) translates its start/end, not just the bounding frame', () => {
    useBoardStore.getState().addLine({ x: 0, y: 0 }, { x: 40, y: 0 })
    const line = useBoardStore.getState().board.nodes.find((n) => n.kind === 'line')!
    useBoardStore.getState().setFrames([{ id: line.id, frame: { ...line.frame, x: line.frame.x + 100, y: line.frame.y + 5 } }])
    const board = useBoardStore.getState().board
    const moved = board.nodes.find((n) => n.id === line.id)
    const img = board.nodes.find((n) => n.id === 'img')!
    expect(moved).toMatchObject({
      start: { x: 100 + img.frame.x, y: 5 + img.frame.y },
      end: { x: 140 + img.frame.x, y: 5 + img.frame.y },
    })
  })

  it('duplicating a line offsets its start/end along with the frame', () => {
    useBoardStore.getState().addLine({ x: 0, y: 0 }, { x: 40, y: 0 })
    const line = useBoardStore.getState().board.nodes.find((n) => n.kind === 'line')!
    useBoardStore.setState({ selectedIds: [line.id] })
    useBoardStore.getState().duplicateSelected()
    const copyId = useBoardStore.getState().selectedIds[0]!
    const copy = useBoardStore.getState().board.nodes.find((n) => n.id === copyId)
    expect(copy).toMatchObject({ start: { x: 16, y: 16 }, end: { x: 56, y: 16 } })
  })

  it('is excluded from toRenderInput.items and step badge numbering, and appears in .lines', () => {
    useBoardStore.setState({ board: { ...useBoardStore.getState().board, layout: 'steps', resolvedLayout: 'steps' } })
    useBoardStore.getState().addLine({ x: 0, y: 0 }, { x: 40, y: 0 })
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.items.map((i) => i.id)).toEqual(['img'])
    expect(input.items[0]?.badge).toBe(1)
    expect(input.lines).toHaveLength(1)
    expect(input.lines![0]).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 40, y: 0 } })
  })

  it('can be deleted and undone like any other node', () => {
    useBoardStore.getState().addLine({ x: 0, y: 0 }, { x: 40, y: 0 })
    const lineId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'line')!.id
    useBoardStore.setState({ selectedIds: [lineId] })
    useBoardStore.getState().deleteSelected()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === lineId)).toBeUndefined()

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === lineId)).toBeDefined()
  })
})

describe('addBox', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('img', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: [],
      tool: 'box',
    })
  })

  it('adds a box node from the two drag corners, selects it, leaves layout untouched, and returns to the select tool', () => {
    useBoardStore.getState().addBox({ x: 0, y: 0 }, { x: 40, y: 30 })
    const board = useBoardStore.getState().board
    const box = board.nodes.find((n) => n.kind === 'box')
    expect(box).toBeDefined()
    expect(box!.frame).toEqual({ x: 0, y: 0, w: 40, h: 30 })
    expect(board.layout).toBe('auto')
    expect(useBoardStore.getState().selectedIds).toEqual([box!.id])
    expect(useBoardStore.getState().tool).toBe('select')
  })

  it('normalizes the frame regardless of which corner was dragged from', () => {
    useBoardStore.getState().addBox({ x: 40, y: 30 }, { x: 0, y: 0 })
    const box = useBoardStore.getState().board.nodes.find((n) => n.kind === 'box')!
    expect(box.frame).toEqual({ x: 0, y: 0, w: 40, h: 30 })
  })

  it('does not disturb the existing image node', () => {
    useBoardStore.getState().addBox({ x: 0, y: 0 }, { x: 40, y: 30 })
    const board = useBoardStore.getState().board
    expect(board.nodes.find((n) => n.id === 'img')?.frame).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })

  it('moving a box (setFrames) just sets the new frame directly, same as an image', () => {
    useBoardStore.getState().addBox({ x: 0, y: 0 }, { x: 40, y: 30 })
    const box = useBoardStore.getState().board.nodes.find((n) => n.kind === 'box')!
    useBoardStore.getState().setFrames([{ id: box.id, frame: { x: 100, y: 5, w: 40, h: 30 } }])
    const board = useBoardStore.getState().board
    const moved = board.nodes.find((n) => n.id === box.id)
    // See the arrow test above - fitBoardToContent shifts every node uniformly.
    const img = board.nodes.find((n) => n.id === 'img')!
    expect(moved?.frame).toEqual({ x: 100 + img.frame.x, y: 5 + img.frame.y, w: 40, h: 30 })
  })

  it('duplicating a box offsets its frame like an image', () => {
    useBoardStore.getState().addBox({ x: 0, y: 0 }, { x: 40, y: 30 })
    const box = useBoardStore.getState().board.nodes.find((n) => n.kind === 'box')!
    useBoardStore.setState({ selectedIds: [box.id] })
    useBoardStore.getState().duplicateSelected()
    const copyId = useBoardStore.getState().selectedIds[0]!
    const copy = useBoardStore.getState().board.nodes.find((n) => n.id === copyId)
    expect(copy?.frame).toEqual({ x: 16, y: 16, w: 40, h: 30 })
  })

  it('is excluded from toRenderInput.items and step badge numbering, and appears in .boxes', () => {
    useBoardStore.setState({ board: { ...useBoardStore.getState().board, layout: 'steps', resolvedLayout: 'steps' } })
    useBoardStore.getState().addBox({ x: 0, y: 0 }, { x: 40, y: 30 })
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.items.map((i) => i.id)).toEqual(['img'])
    expect(input.items[0]?.badge).toBe(1)
    expect(input.boxes).toHaveLength(1)
    expect(input.boxes![0]).toMatchObject({ frame: { x: 0, y: 0, w: 40, h: 30 } })
  })

  it('can be deleted and undone like any other node', () => {
    useBoardStore.getState().addBox({ x: 0, y: 0 }, { x: 40, y: 30 })
    const boxId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'box')!.id
    useBoardStore.setState({ selectedIds: [boxId] })
    useBoardStore.getState().deleteSelected()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === boxId)).toBeUndefined()

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === boxId)).toBeDefined()
  })
})

describe('commitText', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('img', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: [],
    })
  })

  it('creates a new text node, selects it, and leaves layout untouched', () => {
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const board = useBoardStore.getState().board
    const text = board.nodes.find((n) => n.kind === 'text')
    expect(text).toBeDefined()
    expect(text).toMatchObject({ text: 'hello', frame: { x: 0, y: 0, w: 240, h: 40 } })
    expect(board.layout).toBe('auto')
    expect(useBoardStore.getState().selectedIds).toEqual([text!.id])
  })

  it('creates nothing for trimmed-empty text (a stray click)', () => {
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, '   ')
    const board = useBoardStore.getState().board
    expect(board.nodes.find((n) => n.kind === 'text')).toBeUndefined()
    expect(board.nodes).toHaveLength(1)
  })

  it('does not disturb the existing image node', () => {
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const board = useBoardStore.getState().board
    expect(board.nodes.find((n) => n.id === 'img')?.frame).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })

  it('re-editing an existing text node updates its frame and text in place', () => {
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const textId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'text')!.id
    useBoardStore.getState().commitText(textId, { x: 0, y: 0, w: 240, h: 70 }, 'hello world')
    const text = useBoardStore.getState().board.nodes.find((n) => n.id === textId)
    expect(text).toMatchObject({ text: 'hello world', frame: { x: 0, y: 0, w: 240, h: 70 } })
  })

  it('re-editing with an explicit size updates the font size too; omitting it leaves the size unchanged', () => {
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const textId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'text')!.id
    const originalSize = (useBoardStore.getState().board.nodes.find((n) => n.id === textId) as { size: number }).size

    useBoardStore.getState().commitText(textId, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    expect((useBoardStore.getState().board.nodes.find((n) => n.id === textId) as { size: number }).size).toBe(originalSize)

    useBoardStore.getState().commitText(textId, { x: 0, y: 0, w: 240, h: 60 }, 'hello', 30)
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === textId)).toMatchObject({ size: 30, frame: { h: 60 } })
  })

  it('re-editing to trimmed-empty text deletes the node instead of leaving a blank annotation', () => {
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const textId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'text')!.id
    useBoardStore.setState({ selectedIds: [textId] })
    useBoardStore.getState().commitText(textId, { x: 0, y: 0, w: 240, h: 40 }, '   ')
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === textId)).toBeUndefined()
    expect(useBoardStore.getState().selectedIds).toEqual([])
  })

  it('is excluded from toRenderInput.items and step badge numbering, and appears in .texts', () => {
    useBoardStore.setState({ board: { ...useBoardStore.getState().board, layout: 'steps', resolvedLayout: 'steps' } })
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.items.map((i) => i.id)).toEqual(['img'])
    expect(input.items[0]?.badge).toBe(1)
    expect(input.texts).toHaveLength(1)
    expect(input.texts![0]).toMatchObject({ text: 'hello', frame: { x: 0, y: 0, w: 240, h: 40 } })
  })

  it('can be deleted and undone like any other node', () => {
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const textId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'text')!.id
    useBoardStore.setState({ selectedIds: [textId] })
    useBoardStore.getState().deleteSelected()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === textId)).toBeUndefined()

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === textId)).toBeDefined()
  })
})

describe('addMarker', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('img', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: [],
      tool: 'marker',
    })
  })

  it('adds a marker centered on the click point, selects it, leaves layout untouched, and returns to the select tool', () => {
    useBoardStore.getState().addMarker({ x: 20, y: 20 })
    const board = useBoardStore.getState().board
    const marker = board.nodes.find((n) => n.kind === 'marker')
    expect(marker).toBeDefined()
    expect(marker!.frame.x + marker!.frame.w / 2).toBeCloseTo(20, 5)
    expect(marker!.frame.y + marker!.frame.h / 2).toBeCloseTo(20, 5)
    expect(board.layout).toBe('auto')
    expect(useBoardStore.getState().selectedIds).toEqual([marker!.id])
    expect(useBoardStore.getState().tool).toBe('select')
  })

  it('does not disturb the existing image node', () => {
    useBoardStore.getState().addMarker({ x: 20, y: 20 })
    const board = useBoardStore.getState().board
    expect(board.nodes.find((n) => n.id === 'img')?.frame).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })

  it('moving a marker (setFrames) just sets the new frame directly, same as an image', () => {
    useBoardStore.getState().addMarker({ x: 20, y: 20 })
    const marker = useBoardStore.getState().board.nodes.find((n) => n.kind === 'marker')!
    useBoardStore.getState().setFrames([{ id: marker.id, frame: { x: 100, y: 5, w: marker.frame.w, h: marker.frame.h } }])
    const board = useBoardStore.getState().board
    const moved = board.nodes.find((n) => n.id === marker.id)
    // See the arrow test above - fitBoardToContent shifts every node uniformly.
    const img = board.nodes.find((n) => n.id === 'img')!
    expect(moved?.frame).toEqual({ x: 100 + img.frame.x, y: 5 + img.frame.y, w: marker.frame.w, h: marker.frame.h })
  })

  it('duplicating a marker offsets its frame like an image', () => {
    useBoardStore.getState().addMarker({ x: 20, y: 20 })
    const marker = useBoardStore.getState().board.nodes.find((n) => n.kind === 'marker')!
    useBoardStore.setState({ selectedIds: [marker.id] })
    useBoardStore.getState().duplicateSelected()
    const copyId = useBoardStore.getState().selectedIds[0]!
    const copy = useBoardStore.getState().board.nodes.find((n) => n.id === copyId)
    expect(copy?.frame).toEqual({ x: marker.frame.x + 16, y: marker.frame.y + 16, w: marker.frame.w, h: marker.frame.h })
  })

  it('is excluded from toRenderInput.items and step badge numbering, and appears numbered in .markers', () => {
    useBoardStore.setState({ board: { ...useBoardStore.getState().board, layout: 'steps', resolvedLayout: 'steps' } })
    useBoardStore.getState().addMarker({ x: 20, y: 20 })
    useBoardStore.setState({ tool: 'marker' })
    useBoardStore.getState().addMarker({ x: 60, y: 60 })
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.items.map((i) => i.id)).toEqual(['img'])
    expect(input.items[0]?.badge).toBe(1)
    expect(input.markers).toHaveLength(2)
    expect(input.markers!.map((m) => m.number)).toEqual([1, 2])
  })

  it('renumbers the remaining markers after one is deleted', () => {
    useBoardStore.getState().addMarker({ x: 20, y: 20 })
    const firstId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'marker')!.id
    useBoardStore.setState({ tool: 'marker' })
    useBoardStore.getState().addMarker({ x: 60, y: 60 })

    useBoardStore.setState({ selectedIds: [firstId] })
    useBoardStore.getState().deleteSelected()
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.markers).toHaveLength(1)
    expect(input.markers![0]?.number).toBe(1)
  })

  it('can be deleted and undone like any other node', () => {
    useBoardStore.getState().addMarker({ x: 20, y: 20 })
    const markerId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'marker')!.id
    useBoardStore.setState({ selectedIds: [markerId] })
    useBoardStore.getState().deleteSelected()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === markerId)).toBeUndefined()

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === markerId)).toBeDefined()
  })
})

describe('addRedact', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('img', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: [],
      tool: 'redact',
    })
  })

  it('adds a redact node from the two drag corners, selects it, leaves layout untouched, and returns to the select tool', () => {
    useBoardStore.getState().addRedact({ x: 0, y: 0 }, { x: 40, y: 30 })
    const board = useBoardStore.getState().board
    const redact = board.nodes.find((n) => n.kind === 'redact')
    expect(redact).toBeDefined()
    expect(redact!.frame).toEqual({ x: 0, y: 0, w: 40, h: 30 })
    expect(board.layout).toBe('auto')
    expect(useBoardStore.getState().selectedIds).toEqual([redact!.id])
    expect(useBoardStore.getState().tool).toBe('select')
  })

  it('normalizes the frame regardless of which corner was dragged from', () => {
    useBoardStore.getState().addRedact({ x: 40, y: 30 }, { x: 0, y: 0 })
    const redact = useBoardStore.getState().board.nodes.find((n) => n.kind === 'redact')!
    expect(redact.frame).toEqual({ x: 0, y: 0, w: 40, h: 30 })
  })

  it('does not disturb the existing image node', () => {
    useBoardStore.getState().addRedact({ x: 0, y: 0 }, { x: 40, y: 30 })
    const board = useBoardStore.getState().board
    expect(board.nodes.find((n) => n.id === 'img')?.frame).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })

  it('moving a redaction (setFrames) just sets the new frame directly, same as an image', () => {
    useBoardStore.getState().addRedact({ x: 0, y: 0 }, { x: 40, y: 30 })
    const redact = useBoardStore.getState().board.nodes.find((n) => n.kind === 'redact')!
    useBoardStore.getState().setFrames([{ id: redact.id, frame: { x: 100, y: 5, w: 40, h: 30 } }])
    const board = useBoardStore.getState().board
    const moved = board.nodes.find((n) => n.id === redact.id)
    // See the arrow test above - fitBoardToContent shifts every node uniformly.
    const img = board.nodes.find((n) => n.id === 'img')!
    expect(moved?.frame).toEqual({ x: 100 + img.frame.x, y: 5 + img.frame.y, w: 40, h: 30 })
  })

  it('duplicating a redaction offsets its frame like an image', () => {
    useBoardStore.getState().addRedact({ x: 0, y: 0 }, { x: 40, y: 30 })
    const redact = useBoardStore.getState().board.nodes.find((n) => n.kind === 'redact')!
    useBoardStore.setState({ selectedIds: [redact.id] })
    useBoardStore.getState().duplicateSelected()
    const copyId = useBoardStore.getState().selectedIds[0]!
    const copy = useBoardStore.getState().board.nodes.find((n) => n.id === copyId)
    expect(copy?.frame).toEqual({ x: 16, y: 16, w: 40, h: 30 })
  })

  it('is excluded from toRenderInput.items and step badge numbering, and appears in .redacts', () => {
    useBoardStore.setState({ board: { ...useBoardStore.getState().board, layout: 'steps', resolvedLayout: 'steps' } })
    useBoardStore.getState().addRedact({ x: 0, y: 0 }, { x: 40, y: 30 })
    const input = toRenderInput(useBoardStore.getState().board)
    expect(input.items.map((i) => i.id)).toEqual(['img'])
    expect(input.items[0]?.badge).toBe(1)
    expect(input.redacts).toHaveLength(1)
    expect(input.redacts![0]).toMatchObject({ frame: { x: 0, y: 0, w: 40, h: 30 } })
  })

  it('can be deleted and undone like any other node', () => {
    useBoardStore.getState().addRedact({ x: 0, y: 0 }, { x: 40, y: 30 })
    const redactId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'redact')!.id
    useBoardStore.setState({ selectedIds: [redactId] })
    useBoardStore.getState().deleteSelected()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === redactId)).toBeUndefined()

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === redactId)).toBeDefined()
  })
})

describe('undo/redo', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', gap: 20, nodes: [node('a', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: [],
      past: [],
      future: [],
      adjustmentBase: null,
    })
  })

  it('reverts the last committed action and redo re-applies it', () => {
    useBoardStore.getState().setGap(40)
    expect(useBoardStore.getState().board.gap).toBe(40)

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.gap).toBe(20)

    useBoardStore.getState().redo()
    expect(useBoardStore.getState().board.gap).toBe(40)
  })

  it('does nothing when there is nothing to undo or redo', () => {
    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.gap).toBe(20)
    useBoardStore.getState().redo()
    expect(useBoardStore.getState().board.gap).toBe(20)
  })

  it('discards the redo branch once a new action is committed after an undo', () => {
    useBoardStore.getState().setGap(40)
    useBoardStore.getState().setGap(60)
    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.gap).toBe(40)

    useBoardStore.getState().setGap(99)
    expect(useBoardStore.getState().future).toHaveLength(0)
    useBoardStore.getState().redo()
    expect(useBoardStore.getState().board.gap).toBe(99)
  })

  it('restores a deleted node on undo', () => {
    useBoardStore.setState({ selectedIds: ['a'] })
    useBoardStore.getState().deleteSelected()
    expect(useBoardStore.getState().board.nodes).toHaveLength(0)

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('prunes selection to nodes that still exist in the restored board', () => {
    useBoardStore.setState({ selectedIds: ['a'] })
    useBoardStore.getState().duplicateSelected()
    const copyId = useBoardStore.getState().selectedIds[0]!
    expect(copyId).not.toBe('a')

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.map((n) => n.id)).toEqual(['a'])
    expect(useBoardStore.getState().selectedIds).toEqual([])
  })

  it('caps undo history at 50 steps', () => {
    for (let i = 1; i <= 60; i++) useBoardStore.getState().setGap(i)
    expect(useBoardStore.getState().past).toHaveLength(50)
    for (let i = 0; i < 60; i++) useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.gap).toBe(10)
  })
})

describe('beginAdjustment/endAdjustment', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', gap: 20, nodes: [] },
      past: [],
      future: [],
      adjustmentBase: null,
    })
  })

  it('collapses a whole dragged gesture into a single undo step', () => {
    useBoardStore.getState().beginAdjustment()
    useBoardStore.getState().setGap(30)
    useBoardStore.getState().setGap(45)
    useBoardStore.getState().setGap(60)
    useBoardStore.getState().endAdjustment()

    expect(useBoardStore.getState().board.gap).toBe(60)
    expect(useBoardStore.getState().past).toHaveLength(1)

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.gap).toBe(20)
  })

  it('commits no history entry when the gesture never changed anything', () => {
    useBoardStore.getState().beginAdjustment()
    useBoardStore.getState().endAdjustment()
    expect(useBoardStore.getState().past).toHaveLength(0)
  })
})

describe('recovery', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, nodes: [node('a', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: ['a'],
      recoveredBoard: null,
      past: [],
      future: [],
    })
  })

  it('hydrate is a no-op when there is nothing autosaved (e.g. IndexedDB unavailable)', async () => {
    await useBoardStore.getState().hydrate()
    const board = useBoardStore.getState().board
    expect(board.nodes.map((n) => n.id)).toEqual(['a'])
    expect(useBoardStore.getState().recoveredBoard).toBeNull()
  })

  it('dismissRecovery hides the banner without touching the board', () => {
    useBoardStore.setState({ recoveredBoard: useBoardStore.getState().board })
    useBoardStore.getState().dismissRecovery()
    expect(useBoardStore.getState().recoveredBoard).toBeNull()
    expect(useBoardStore.getState().board.nodes).toHaveLength(1)
  })

  it('startFresh empties the board, clears selection, and hides the banner', () => {
    useBoardStore.setState({ recoveredBoard: useBoardStore.getState().board })
    useBoardStore.getState().startFresh()
    expect(useBoardStore.getState().board.nodes).toHaveLength(0)
    expect(useBoardStore.getState().selectedIds).toEqual([])
    expect(useBoardStore.getState().recoveredBoard).toBeNull()
  })

  it('startFresh can still be undone, same as clear()', () => {
    useBoardStore.getState().startFresh()
    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes.map((n) => n.id)).toEqual(['a'])
  })
})

describe('clear / lastCleared', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, nodes: [node('a', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: ['a'],
      recoveredBoard: null,
      lastCleared: null,
      past: [],
      future: [],
    })
  })

  it('clear() sets lastCleared to the board it just emptied', () => {
    useBoardStore.getState().clear()
    expect(useBoardStore.getState().board.nodes).toHaveLength(0)
    expect(useBoardStore.getState().lastCleared?.nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('clear() on an already-empty board leaves lastCleared untouched', () => {
    useBoardStore.getState().clear()
    const first = useBoardStore.getState().lastCleared
    useBoardStore.getState().clear()
    expect(useBoardStore.getState().lastCleared).toBe(first)
  })

  it('clear() supersedes any stale "recovered your last board" banner', () => {
    useBoardStore.setState({ recoveredBoard: useBoardStore.getState().board })
    useBoardStore.getState().clear()
    expect(useBoardStore.getState().recoveredBoard).toBeNull()
  })

  it('restoreLastCleared brings the board back, as an undoable commit', () => {
    useBoardStore.getState().clear()
    useBoardStore.getState().restoreLastCleared()
    expect(useBoardStore.getState().board.nodes.map((n) => n.id)).toEqual(['a'])
    expect(useBoardStore.getState().lastCleared).toBeNull()

    useBoardStore.getState().undo()
    expect(useBoardStore.getState().board.nodes).toHaveLength(0)
  })

  it('dismissLastCleared hides the banner without touching the board', () => {
    useBoardStore.getState().clear()
    useBoardStore.getState().dismissLastCleared()
    expect(useBoardStore.getState().lastCleared).toBeNull()
    expect(useBoardStore.getState().board.nodes).toHaveLength(0)
  })

  it('startFresh also clears any pending lastCleared banner', () => {
    useBoardStore.getState().clear()
    useBoardStore.getState().startFresh()
    expect(useBoardStore.getState().lastCleared).toBeNull()
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

describe('toolSettings', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [] },
      selectedIds: [],
      tool: 'select',
      toolSettings: {
        arrow: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.arrow.default, straight: true },
        line: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.line.default },
        box: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.box.default },
        text: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.text.default },
        marker: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.marker.default },
        redact: { color: REDACT_DEFAULT_COLOR },
      },
    })
  })

  it('starts every tool at the shared default color, and redact at pure black instead', () => {
    const s = useBoardStore.getState().toolSettings
    expect(s.arrow.color).toBe(DEFAULT_ANNOTATION_COLOR)
    expect(s.line.color).toBe(DEFAULT_ANNOTATION_COLOR)
    expect(s.box.color).toBe(DEFAULT_ANNOTATION_COLOR)
    expect(s.text.color).toBe(DEFAULT_ANNOTATION_COLOR)
    expect(s.marker.color).toBe(DEFAULT_ANNOTATION_COLOR)
    expect(s.redact.color).toBe('#000000')
  })

  it('starts the arrow tool straight by default, per real-usage feedback that a curve alone "looks unprofessional"', () => {
    expect(useBoardStore.getState().toolSettings.arrow.straight).toBe(true)
  })

  it('setArrowStraight toggles the arrow tool default without touching color/size', () => {
    useBoardStore.getState().setArrowStraight(false)
    const s = useBoardStore.getState().toolSettings.arrow
    expect(s.straight).toBe(false)
    expect(s.color).toBe(DEFAULT_ANNOTATION_COLOR)
    expect(s.size).toBe(ANNOTATION_SIZE_RANGE.arrow.default)
  })

  it('setToolColor changes only the given tool', () => {
    useBoardStore.getState().setToolColor('box', '#16a34a')
    const s = useBoardStore.getState().toolSettings
    expect(s.box.color).toBe('#16a34a')
    expect(s.arrow.color).toBe(DEFAULT_ANNOTATION_COLOR)
  })

  it('setToolSize clamps to the tool range', () => {
    useBoardStore.getState().setToolSize('arrow', 999)
    expect(useBoardStore.getState().toolSettings.arrow.size).toBe(ANNOTATION_SIZE_RANGE.arrow.max)
    useBoardStore.getState().setToolSize('arrow', -50)
    expect(useBoardStore.getState().toolSettings.arrow.size).toBe(ANNOTATION_SIZE_RANGE.arrow.min)
  })

  it('adjustToolSize nudges relative to the current value and clamps at the edges', () => {
    useBoardStore.getState().adjustToolSize('marker', 5)
    expect(useBoardStore.getState().toolSettings.marker.size).toBe(ANNOTATION_SIZE_RANGE.marker.default + 5)
    useBoardStore.getState().setToolSize('marker', ANNOTATION_SIZE_RANGE.marker.max)
    useBoardStore.getState().adjustToolSize('marker', 10)
    expect(useBoardStore.getState().toolSettings.marker.size).toBe(ANNOTATION_SIZE_RANGE.marker.max)
  })

  it('a newly created arrow/box/marker/redact picks up the currently armed color and size', () => {
    useBoardStore.getState().setToolColor('arrow', '#0ea5e9')
    useBoardStore.getState().setToolSize('arrow', 10)
    useBoardStore.getState().setToolColor('redact', '#111827')
    useBoardStore.setState({ tool: 'arrow' })
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const arrow = useBoardStore.getState().board.nodes.find((n) => n.kind === 'arrow')
    expect(arrow).toMatchObject({ color: '#0ea5e9', size: 10 })

    useBoardStore.setState({ tool: 'redact' })
    useBoardStore.getState().addRedact({ x: 0, y: 0 }, { x: 40, y: 30 })
    const redact = useBoardStore.getState().board.nodes.find((n) => n.kind === 'redact')
    expect(redact).toMatchObject({ color: '#111827' })
  })

  it('a newly created arrow picks up the currently armed straight/curved setting', () => {
    useBoardStore.getState().setArrowStraight(false)
    useBoardStore.setState({ tool: 'arrow' })
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const curved = useBoardStore.getState().board.nodes.find((n) => n.kind === 'arrow')
    expect(curved).toMatchObject({ straight: false })

    useBoardStore.getState().setArrowStraight(true)
    useBoardStore.getState().addArrow({ x: 0, y: 50 }, { x: 40, y: 50 })
    const arrows = useBoardStore.getState().board.nodes.filter((n) => n.kind === 'arrow')
    expect(arrows[1]).toMatchObject({ straight: true })
  })

  it('a newly created marker uses the armed diameter as its frame size', () => {
    useBoardStore.getState().setToolSize('marker', 60)
    useBoardStore.setState({ tool: 'marker' })
    useBoardStore.getState().addMarker({ x: 20, y: 20 })
    const marker = useBoardStore.getState().board.nodes.find((n) => n.kind === 'marker')!
    expect(marker.frame.w).toBe(60)
    expect(marker.frame.h).toBe(60)
  })

  it('a newly created text node uses the armed color and font size', () => {
    useBoardStore.getState().setToolColor('text', '#9333ea')
    useBoardStore.getState().setToolSize('text', 30)
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const text = useBoardStore.getState().board.nodes.find((n) => n.kind === 'text')
    expect(text).toMatchObject({ color: '#9333ea', size: 30 })
  })
})

describe('setNodeColor / setNodeSize (editing an already-placed annotation, not a tool default)', () => {
  beforeEach(() => {
    useBoardStore.setState({
      board: { ...DEFAULT_BOARD, layout: 'auto', nodes: [node('img', { x: 0, y: 0, w: 10, h: 10 })] },
      selectedIds: [],
      tool: 'select',
    })
  })

  it('recolors an existing arrow/box/marker/redact node in place, unlike setToolColor which only affects the next one drawn', () => {
    useBoardStore.setState({ tool: 'arrow' })
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const arrowId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'arrow')!.id

    useBoardStore.getState().setNodeColor(arrowId, '#16a34a')
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === arrowId)).toMatchObject({ color: '#16a34a' })
    // toolSettings (the default for the *next* arrow) is untouched.
    expect(useBoardStore.getState().toolSettings.arrow.color).not.toBe('#16a34a')
  })

  it('is a no-op for an image node (no color field) or a missing id', () => {
    useBoardStore.getState().setNodeColor('img', '#16a34a')
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === 'img')?.frame).toEqual({ x: 0, y: 0, w: 10, h: 10 })
    useBoardStore.getState().setNodeColor('does-not-exist', '#16a34a')
    expect(useBoardStore.getState().board.nodes).toHaveLength(1)
  })

  it('setNodeStraight toggles an already-placed arrow in place, unlike setArrowStraight which only affects the next one drawn', () => {
    useBoardStore.setState({ tool: 'arrow' })
    useBoardStore.getState().addArrow({ x: 0, y: 0 }, { x: 40, y: 0 })
    const arrowId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'arrow')!.id

    useBoardStore.getState().setNodeStraight(arrowId, false)
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === arrowId)).toMatchObject({ straight: false })
    // toolSettings (the default for the *next* arrow) is untouched.
    expect(useBoardStore.getState().toolSettings.arrow.straight).toBe(true)
  })

  it('setNodeStraight is a no-op for a non-arrow node', () => {
    useBoardStore.setState({ tool: 'box' })
    useBoardStore.getState().addBox({ x: 0, y: 0 }, { x: 40, y: 30 })
    const boxId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'box')!.id
    useBoardStore.getState().setNodeStraight(boxId, false)
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === boxId)).not.toHaveProperty('straight')
  })

  it('resizes an existing arrow/box by its size field, clamped to the tool range', () => {
    useBoardStore.setState({ tool: 'box' })
    useBoardStore.getState().addBox({ x: 0, y: 0 }, { x: 40, y: 30 })
    const boxId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'box')!.id

    useBoardStore.getState().setNodeSize(boxId, 8)
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === boxId)).toMatchObject({ size: 8 })

    useBoardStore.getState().setNodeSize(boxId, 999)
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === boxId)).toMatchObject({ size: ANNOTATION_SIZE_RANGE.box.max })
  })

  it('resizes an existing marker by recentering its frame on the unchanged center point, not a size field', () => {
    useBoardStore.setState({ tool: 'marker' })
    useBoardStore.getState().addMarker({ x: 50, y: 50 })
    const marker = useBoardStore.getState().board.nodes.find((n) => n.kind === 'marker')!
    const center = { x: marker.frame.x + marker.frame.w / 2, y: marker.frame.y + marker.frame.h / 2 }

    useBoardStore.getState().setNodeSize(marker.id, 50)
    const resized = useBoardStore.getState().board.nodes.find((n) => n.id === marker.id)!
    expect(resized.frame.w).toBe(50)
    expect(resized.frame.h).toBe(50)
    expect(resized.frame.x + resized.frame.w / 2).toBeCloseTo(center.x, 5)
    expect(resized.frame.y + resized.frame.h / 2).toBeCloseTo(center.y, 5)
  })

  it('is a no-op for text and redact - text is resized through commitText instead, redact has no size at all', () => {
    useBoardStore.getState().commitText(null, { x: 0, y: 0, w: 240, h: 40 }, 'hello')
    const textId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'text')!.id
    useBoardStore.getState().setNodeSize(textId, 30)
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === textId)).toMatchObject({ text: 'hello' })

    useBoardStore.setState({ tool: 'redact' })
    useBoardStore.getState().addRedact({ x: 0, y: 0 }, { x: 40, y: 30 })
    const redactId = useBoardStore.getState().board.nodes.find((n) => n.kind === 'redact')!.id
    useBoardStore.getState().setNodeSize(redactId, 30)
    expect(useBoardStore.getState().board.nodes.find((n) => n.id === redactId)?.frame).toEqual({ x: 0, y: 0, w: 40, h: 30 })
  })
})
