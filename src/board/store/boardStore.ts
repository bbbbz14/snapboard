import { create } from 'zustand'
import { computeLayout } from '@/board/layout/computeLayout'
import {
  BACKGROUNDS,
  DEFAULT_BOARD,
  type Background,
  type BackgroundName,
  type Board,
  type ImageNode,
  type LayoutMode,
  type NodeId,
  type StylePreset,
} from '@/board/model/types'
import { AssetStore, type Asset } from '@/assets/assetStore'
import type { Rejection } from '@/assets/validate'
import type { RenderInput } from '@/board/render/renderScene'
import type { Rect } from '@/lib/geometry'

export const assetStore = new AssetStore()

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'success' | 'warn'
}

interface BoardState {
  board: Board
  /** Not part of `Board`: undo/autosave snapshot `Board`, and selection is not
   * arranged content, just what the user is currently pointing at - same
   * reasoning as keeping the camera out of the store (see camera.ts). */
  selectedIds: NodeId[]
  busy: { done: number; total: number } | null
  toasts: Toast[]
  addFiles: (files: File[]) => Promise<void>
  setLayout: (mode: LayoutMode) => void
  setBackground: (name: BackgroundName) => void
  setStyle: (style: StylePreset) => void
  setGap: (gap: number) => void
  setPadding: (padding: number) => void
  clear: () => void
  setSelection: (ids: NodeId[]) => void
  toggleSelection: (id: NodeId) => void
  /** Commits manually-moved/resized frames. Does not relayout - a manual edit
   * must not be recomputed away by the auto-layout heuristic. */
  setFrames: (updates: { id: NodeId; frame: Rect }[]) => void
  /** Moves a node to `targetIndex` in the auto-layout sequence and relayouts -
   * a still-auto board's own frames come from order, so this is how drag-to-
   * reorder repositions nodes (as opposed to `setFrames`'s free-form move). */
  reorder: (id: NodeId, targetIndex: number) => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

let nodeSeq = 0
let toastSeq = 0

/** Recomputes frames and canvas size from the current nodes. */
function relayout(board: Board): Board {
  if (board.layout === 'free') return board
  const items = [...board.nodes]
    .sort((a, b) => a.order - b.order)
    .map((n) => ({ id: n.id, natural: assetStore.get(n.assetId)?.natural ?? { w: 16, h: 9 } }))

  const result = computeLayout(items, board.layout === 'auto' ? 'auto' : board.layout, {
    gap: board.gap,
    padding: board.padding,
    targetWidth: board.targetWidth,
    columns: board.columns,
  })

  return {
    ...board,
    resolvedLayout: result.mode,
    size: result.size,
    nodes: board.nodes.map((n) => ({ ...n, frame: result.frames[n.id] ?? n.frame })),
  }
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: DEFAULT_BOARD,
  selectedIds: [],
  busy: null,
  toasts: [],

  async addFiles(files) {
    if (files.length === 0) return
    set({ busy: { done: 0, total: files.length } })
    let result: { assets: Asset[]; rejected: Rejection[] }
    try {
      result = await assetStore.ingest(files, (done, total) => set({ busy: { done, total } }))
    } finally {
      set({ busy: null })
    }

    if (result.assets.length > 0) {
      const startOrder = get().board.nodes.length
      const nodes: ImageNode[] = result.assets.map((asset, i) => ({
        kind: 'image',
        id: `n${nodeSeq++}`,
        assetId: asset.id,
        order: startOrder + i,
        frame: { x: 0, y: 0, w: asset.natural.w, h: asset.natural.h },
      }))
      set((s) => ({ board: relayout({ ...s.board, nodes: [...s.board.nodes, ...nodes] }) }))
    }

    for (const r of result.rejected) {
      get().toast(rejectionMessage(r), 'warn')
    }
  },

  setLayout: (mode) => set((s) => ({ board: relayout({ ...s.board, layout: mode }) })),
  setBackground: (name) => set((s) => ({ board: { ...s.board, background: BACKGROUNDS[name] as Background } })),
  setStyle: (style) => set((s) => ({ board: { ...s.board, style } })),
  setGap: (gap) => set((s) => ({ board: relayout({ ...s.board, gap }) })),
  setPadding: (padding) => set((s) => ({ board: relayout({ ...s.board, padding }) })),

  clear: () => {
    for (const n of get().board.nodes) assetStore.release(n.assetId)
    set({ board: { ...DEFAULT_BOARD, nodes: [] }, selectedIds: [] })
  },

  setSelection: (ids) => set({ selectedIds: ids }),
  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),
  setFrames: (updates) =>
    set((s) => {
      const byId = new Map(updates.map((u) => [u.id, u.frame]))
      return {
        // The first manual move/resize switches to 'free' so the very next
        // relayout() (e.g. from adding another image) can't silently
        // overwrite it - see invariant 4.
        board: {
          ...s.board,
          layout: 'free',
          nodes: s.board.nodes.map((n) => (byId.has(n.id) ? { ...n, frame: byId.get(n.id)! } : n)),
        },
      }
    }),

  reorder: (id, targetIndex) =>
    set((s) => {
      const sorted = [...s.board.nodes].sort((a, b) => a.order - b.order)
      const from = sorted.findIndex((n) => n.id === id)
      if (from === -1) return {}
      const [moved] = sorted.splice(from, 1)
      sorted.splice(Math.max(0, Math.min(sorted.length, targetIndex)), 0, moved!)
      return { board: relayout({ ...s.board, nodes: sorted.map((n, i) => ({ ...n, order: i })) }) }
    }),

  toast: (message, tone = 'info') => {
    const id = toastSeq++
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => get().dismissToast(id), 4000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

function rejectionMessage(r: Rejection): string {
  const name = r.name || 'That file'
  switch (r.reason) {
    case 'svg-not-supported':
      return 'SVG files are not supported'
    case 'too-large':
      return `${name} is larger than 50 MB`
    case 'too-many-pixels':
      return `${name} has too many pixels to open safely`
    case 'corrupt':
      return `${name} could not be read as an image`
    default:
      return `${name} is not a supported image`
  }
}

/** Adapts board state into the renderer's input, using display-resolution bitmaps. */
export function toRenderInput(board: Board): RenderInput {
  return {
    size: board.size,
    background: board.background,
    style: board.style,
    items: [...board.nodes]
      .sort((a, b) => a.order - b.order)
      .map((n, i) => ({
        id: n.id,
        frame: n.frame,
        image: assetStore.get(n.assetId)?.display ?? null,
        ...(board.resolvedLayout === 'steps' ? { badge: i + 1 } : {}),
      })),
  }
}
