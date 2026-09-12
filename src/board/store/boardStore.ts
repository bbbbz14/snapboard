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
import { moveToFront } from '@/board/model/zorder'
import { AssetStore, type Asset } from '@/assets/assetStore'
import type { Rejection } from '@/assets/validate'
import type { RenderInput } from '@/board/render/renderScene'
import { translate, type Rect } from '@/lib/geometry'
import { restoreAutosave, scheduleAutosave, wipeAutosave } from '@/board/persist/autosave'

/** Board-space offset applied to a duplicate so it's visibly distinct from
 * the original instead of sitting exactly on top of it. */
const DUPLICATE_OFFSET = 16

/** Undo depth required by the product plan's Phase 2 DoD. */
const MAX_HISTORY = 50

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
  /** Snapshots of `board` to step back/forward to. A plain array of whole
   * boards, not patches - Board is a few KB of JSON with no pixels in it
   * (invariant 3), so this is correct and cheap; see CLAUDE.md item 7. */
  past: Board[]
  future: Board[]
  /** Set while a continuous UI gesture (dragging the gap slider) is
   * live-updating `board` tick by tick; holds the pre-gesture board so
   * `endAdjustment` can push exactly one history entry for the whole
   * gesture instead of one per tick. Mirrors the ref-first "commit once"
   * pattern move/resize already uses, just at the store level. */
  adjustmentBase: Board | null
  busy: { done: number; total: number } | null
  toasts: Toast[]
  /** Set once at startup if autosave had a non-empty board waiting - drives
   * the dismissible "Recovered your last board" bar. Null before hydration
   * finishes, after the user dismisses it, or if there was nothing to
   * recover; it does not track whether recovered content is still present. */
  recoveredBoard: Board | null
  /** Reads the last autosaved board and its images back from IndexedDB and
   * makes them the starting board. Call once, at startup, before the user
   * can commit any action of their own. */
  hydrate: () => Promise<void>
  /** Hides the recovery bar without touching the board. */
  dismissRecovery: () => void
  /** The recovery bar's "Start fresh" action: same empty board as `clear()`,
   * plus an immediate (non-debounced) wipe of autosave storage, since this
   * is a deliberate "throw it away" action, not a routine edit. */
  startFresh: () => void
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
  /** Removes the selected nodes - `commitBoard`'s reconcile only actually
   * frees their assets (invariant 3) once no undo/redo entry references
   * them either, so an undo right after this still has a decoded image to
   * restore. Also the one place `selectedIds` needs pruning, since the ids
   * being removed are the ones being cleared (see item 2's note). */
  deleteSelected: () => void
  /** Copies the selected nodes, offset so they read as distinct from the
   * originals, and selects the copies. */
  duplicateSelected: () => void
  /** Moves the selected nodes to the top of z-order (drawn last). Also
   * relayouts, since `order` doubles as layout position for auto boards -
   * same overload `reorder` already relies on for drag-to-reorder. */
  bringToFront: () => void
  undo: () => void
  redo: () => void
  /** Opens a coalescing window: board updates until `endAdjustment` collapse
   * into a single undo step. Call on pointerdown/keydown of a continuous
   * control (the gap slider); idempotent while already open. */
  beginAdjustment: () => void
  /** Closes the window opened by `beginAdjustment` and commits one history
   * entry for the whole gesture, if it actually changed anything. */
  endAdjustment: () => void
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

/** Every assetId used by any of these boards is "reachable" and must stay
 * decoded - see `AssetStore.reconcile`. */
function reconcileAssets(boards: Board[]): void {
  const counts = new Map<string, number>()
  for (const b of boards) {
    for (const n of b.nodes) counts.set(n.assetId, (counts.get(n.assetId) ?? 0) + 1)
  }
  assetStore.reconcile(counts)
}

/** The single path every board mutation commits through. While an
 * adjustment window is open (see `beginAdjustment`), it just updates `board`
 * - the pre-gesture snapshot goes to `past` once, in `endAdjustment` - so a
 * slider drag is one undo step, not one per tick (product plan 13.1: "merge
 * consecutive actions"). Otherwise it pushes the *previous* `board` onto
 * `past` (capped at MAX_HISTORY) and clears `future`, same as any editor's
 * "new action discards the redo branch" rule. */
function commitBoard(s: BoardState, board: Board): Pick<BoardState, 'board' | 'past' | 'future'> {
  autosave(board)
  if (s.adjustmentBase) {
    reconcileAssets([board, s.adjustmentBase, ...s.past, ...s.future])
    return { board, past: s.past, future: s.future }
  }
  const past = [...s.past, s.board].slice(-MAX_HISTORY)
  reconcileAssets([board, ...past])
  return { board, past, future: [] }
}

/** Every commit path (including undo/redo, which build their own return
 * value instead of calling `commitBoard`) runs through this so autosave
 * never has a mutation that silently skips it. */
function autosave(board: Board): void {
  scheduleAutosave(board, (assetId) => assetStore.get(assetId)?.blob)
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: DEFAULT_BOARD,
  selectedIds: [],
  past: [],
  future: [],
  adjustmentBase: null,
  busy: null,
  toasts: [],
  recoveredBoard: null,

  async hydrate() {
    const restored = await restoreAutosave()
    if (!restored) return
    const { board, assets } = restored

    const uniqueIds = [...new Set(board.nodes.map((n) => n.assetId))]
    const decoded = new Map<string, Asset>()
    await Promise.all(
      uniqueIds.map(async (id) => {
        const blob = assets.get(id)
        if (!blob) return
        const asset = await assetStore.restore(id, blob)
        if (asset) decoded.set(id, asset)
      }),
    )

    // A node whose asset failed to come back (corrupt store) would otherwise
    // render forever with no image - drop it rather than leave it broken.
    const nodes = board.nodes.filter((n) => decoded.has(n.assetId))
    const recovered: Board =
      nodes.length === board.nodes.length
        ? board
        : relayout({ ...board, nodes: nodes.map((n, i) => ({ ...n, order: i })) })
    if (recovered.nodes.length === 0) return

    for (const n of recovered.nodes) {
      const match = /^n(\d+)$/.exec(n.id)
      if (match) nodeSeq = Math.max(nodeSeq, Number(match[1]) + 1)
    }
    reconcileAssets([recovered])
    set({ board: recovered, recoveredBoard: recovered })
  },

  dismissRecovery: () => set({ recoveredBoard: null }),

  startFresh: () =>
    set((s) => {
      wipeAutosave()
      return { ...commitBoard(s, { ...DEFAULT_BOARD, nodes: [] }), selectedIds: [], recoveredBoard: null }
    }),

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
      set((s) => commitBoard(s, relayout({ ...s.board, nodes: [...s.board.nodes, ...nodes] })))
    }

    for (const r of result.rejected) {
      get().toast(rejectionMessage(r), 'warn')
    }
  },

  setLayout: (mode) => set((s) => commitBoard(s, relayout({ ...s.board, layout: mode }))),
  setBackground: (name) =>
    set((s) => commitBoard(s, { ...s.board, background: BACKGROUNDS[name] as Background })),
  setStyle: (style) => set((s) => commitBoard(s, { ...s.board, style })),
  setGap: (gap) => set((s) => commitBoard(s, relayout({ ...s.board, gap }))),
  setPadding: (padding) => set((s) => commitBoard(s, relayout({ ...s.board, padding }))),

  clear: () => set((s) => ({ ...commitBoard(s, { ...DEFAULT_BOARD, nodes: [] }), selectedIds: [] })),

  setSelection: (ids) => set({ selectedIds: ids }),
  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),
  setFrames: (updates) =>
    set((s) => {
      const byId = new Map(updates.map((u) => [u.id, u.frame]))
      // The first manual move/resize switches to 'free' so the very next
      // relayout() (e.g. from adding another image) can't silently
      // overwrite it - see invariant 4.
      return commitBoard(s, {
        ...s.board,
        layout: 'free',
        nodes: s.board.nodes.map((n) => (byId.has(n.id) ? { ...n, frame: byId.get(n.id)! } : n)),
      })
    }),

  reorder: (id, targetIndex) =>
    set((s) => {
      const sorted = [...s.board.nodes].sort((a, b) => a.order - b.order)
      const from = sorted.findIndex((n) => n.id === id)
      if (from === -1) return {}
      const [moved] = sorted.splice(from, 1)
      sorted.splice(Math.max(0, Math.min(sorted.length, targetIndex)), 0, moved!)
      return commitBoard(s, relayout({ ...s.board, nodes: sorted.map((n, i) => ({ ...n, order: i })) }))
    }),

  deleteSelected: () =>
    set((s) => {
      const ids = new Set(s.selectedIds)
      if (ids.size === 0) return {}
      const remaining = [...s.board.nodes].filter((n) => !ids.has(n.id)).sort((a, b) => a.order - b.order)
      return {
        ...commitBoard(s, relayout({ ...s.board, nodes: remaining.map((n, i) => ({ ...n, order: i })) })),
        selectedIds: [],
      }
    }),

  duplicateSelected: () =>
    set((s) => {
      const ids = new Set(s.selectedIds)
      if (ids.size === 0) return {}
      const sorted = [...s.board.nodes].sort((a, b) => a.order - b.order)
      const nodes: ImageNode[] = []
      const newIds: NodeId[] = []
      for (const n of sorted) {
        nodes.push(n)
        if (ids.has(n.id)) {
          const copy: ImageNode = {
            ...n,
            id: `n${nodeSeq++}`,
            frame: translate(n.frame, DUPLICATE_OFFSET, DUPLICATE_OFFSET),
          }
          nodes.push(copy)
          newIds.push(copy.id)
        }
      }
      return {
        ...commitBoard(s, relayout({ ...s.board, nodes: nodes.map((n, i) => ({ ...n, order: i })) })),
        selectedIds: newIds,
      }
    }),

  bringToFront: () =>
    set((s) => {
      if (s.selectedIds.length === 0) return {}
      const sorted = [...s.board.nodes].sort((a, b) => a.order - b.order)
      const reordered = moveToFront(sorted, new Set(s.selectedIds))
      return commitBoard(s, relayout({ ...s.board, nodes: reordered.map((n, i) => ({ ...n, order: i })) }))
    }),

  undo: () =>
    set((s) => {
      const previous = s.past[s.past.length - 1]
      if (!previous) return {}
      const past = s.past.slice(0, -1)
      const future = [...s.future, s.board]
      reconcileAssets([previous, ...past, ...future])
      autosave(previous)
      return {
        board: previous,
        past,
        future,
        adjustmentBase: null,
        selectedIds: s.selectedIds.filter((id) => previous.nodes.some((n) => n.id === id)),
      }
    }),

  redo: () =>
    set((s) => {
      const next = s.future[s.future.length - 1]
      if (!next) return {}
      const future = s.future.slice(0, -1)
      const past = [...s.past, s.board]
      reconcileAssets([next, ...past, ...future])
      autosave(next)
      return {
        board: next,
        past,
        future,
        adjustmentBase: null,
        selectedIds: s.selectedIds.filter((id) => next.nodes.some((n) => n.id === id)),
      }
    }),

  beginAdjustment: () => set((s) => (s.adjustmentBase ? {} : { adjustmentBase: s.board })),
  endAdjustment: () =>
    set((s) => {
      const base = s.adjustmentBase
      if (!base) return {}
      if (base === s.board) return { adjustmentBase: null }
      const past = [...s.past, base].slice(-MAX_HISTORY)
      reconcileAssets([s.board, ...past])
      return { past, future: [], adjustmentBase: null }
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
