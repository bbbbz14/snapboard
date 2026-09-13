import { create } from 'zustand'
import { computeLayout } from '@/board/layout/computeLayout'
import {
  BACKGROUNDS,
  DEFAULT_BOARD,
  type ArrowNode,
  type Background,
  type BackgroundName,
  type Board,
  type BoardNode,
  type BoxNode,
  type ImageNode,
  type LayoutMode,
  type MarkerNode,
  type NodeId,
  type RedactNode,
  type StylePreset,
  type TextNode,
} from '@/board/model/types'
import {
  ANNOTATION_SIZE_RANGE,
  DEFAULT_ANNOTATION_COLOR,
  clampAnnotationSize,
  type AnnotationTool,
  type SizableAnnotationTool,
  type Tool,
} from '@/board/model/annotationDefaults'
import { moveToFront } from '@/board/model/zorder'
import { AssetStore, type Asset } from '@/assets/assetStore'
import type { Rejection } from '@/assets/validate'
import { arrowFrame } from '@/board/render/arrow'
import { markerFrame } from '@/board/render/marker'
import { REDACT_DEFAULT_COLOR } from '@/board/render/redact'
import type { RenderInput } from '@/board/render/renderScene'
import { boundsOf, rectFromPoints, translate, translatePoint, type Point, type Rect } from '@/lib/geometry'
import {
  restoreAutosave,
  restoreLastCleared as restoreLastClearedFromDB,
  saveLastCleared,
  scheduleAutosave,
  wipeAutosave,
  wipeLastCleared,
} from '@/board/persist/autosave'

/** Board-space offset applied to a duplicate so it's visibly distinct from
 * the original instead of sitting exactly on top of it. */
const DUPLICATE_OFFSET = 16

/** Undo depth required by the product plan's Phase 2 DoD. */
const MAX_HISTORY = 50

/** Per-tool color (and, except for redact, size) currently armed - what the
 * *next* arrow/box/text/marker/redact will be created with, adjusted via the
 * `AnnotationSettingsPopover` or by scrolling the mouse wheel while a tool is
 * armed (see BoardCanvas's wheel handler). Not part of `Board` - same
 * reasoning as `selectedIds`/camera/export options: a UI preference for what
 * to draw next, not arranged content, so it's untouched by undo/redo and
 * never autosaved. */
export interface ToolSettings {
  arrow: { color: string; size: number }
  box: { color: string; size: number }
  text: { color: string; size: number }
  marker: { color: string; size: number }
  redact: { color: string }
}

const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  arrow: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.arrow.default },
  box: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.box.default },
  text: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.text.default },
  marker: { color: DEFAULT_ANNOTATION_COLOR, size: ANNOTATION_SIZE_RANGE.marker.default },
  // Deliberately not DEFAULT_ANNOTATION_COLOR (red) - a redaction a user
  // hasn't touched the color picker for must stay exactly opaque black, see
  // REDACT_DEFAULT_COLOR's own note.
  redact: { color: REDACT_DEFAULT_COLOR },
}

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
  /** The board `clear()` most recently emptied, still fully decoded and
   * ready to restore in one click - a misclick safety net, distinct from
   * `recoveredBoard`'s "you left with unsaved work" case. Set the instant
   * `clear()` runs (no IndexedDB round trip needed - the assets are already
   * decoded in memory) and re-populated from IndexedDB on the next `hydrate`
   * if the user reloaded before restoring or dismissing it. Null once
   * restored, dismissed, or superseded by a newer non-empty board. */
  lastCleared: Board | null
  /** Reads the last autosaved board and its images back from IndexedDB and
   * makes them the starting board. Call once, at startup, before the user
   * can commit any action of their own. */
  hydrate: () => Promise<void>
  /** Hides the recovery bar without touching the board. */
  dismissRecovery: () => void
  /** Brings back the board `clear()` most recently emptied, as a normal
   * undoable commit (so undoing the restore just clears it again). */
  restoreLastCleared: () => void
  /** Hides the "board was cleared" bar and drops its IndexedDB snapshot -
   * a conscious "no, I meant to clear it" decision. */
  dismissLastCleared: () => void
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
  /** Commits a crop session (see `interact/crop.ts` and the SelectionToolbar's
   * Crop button): sets an image node's `frame` to the dragged crop window and
   * its `crop` to the matching normalized source rect, in one step - the two
   * must never disagree (see `ImageNode.crop`'s own note). Same "manual edit,
   * switch to free" rule as `setFrames`, since a crop is exactly that: a
   * frame the user set by hand, which relayout must not recompute away. */
  commitCrop: (id: NodeId, frame: Rect, crop: Rect) => void
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
  /** Which pointer gesture on the board canvas means "draw a new
   * arrow/box/redaction", "place a new text box", or "drop a numbered
   * marker" instead of "select/move/marquee" - not part of `Board` for the
   * same reason `selectedIds` isn't: it's what the user is about to do, not
   * arranged content. Reverts to `'select'` the instant an arrow, box,
   * text, marker, or redaction placement commits. */
  tool: Tool
  setTool: (tool: Tool) => void
  /** The color (and, except for redact, size) each annotation tool is
   * currently armed with - see `ToolSettings`'s own note. */
  toolSettings: ToolSettings
  setToolColor: (tool: AnnotationTool, color: string) => void
  setToolSize: (tool: SizableAnnotationTool, size: number) => void
  /** Relative nudge, clamped to the tool's range - what the mouse wheel
   * calls while a tool is armed, one step per wheel event rather than per
   * `deltaY` unit (a fast trackbackpad flick still just means "more wheel
   * events", which already reads as faster). */
  adjustToolSize: (tool: SizableAnnotationTool, delta: number) => void
  /** Commits a new arrow from `start` to `end` (board-space) and switches
   * back to the select tool - same one-shot pattern a stamp tool would use.
   * Deliberately does *not* touch `layout` - unlike `setFrames`, an arrow
   * never moves an image's frame, so `relayout()` (which only ever rewrites
   * `kind === 'image'` frames, see below) stays free to keep auto-arranging
   * images on an `'auto'`/`'rows'`/etc. board with arrows already on it. */
  addArrow: (start: Point, end: Point) => void
  /** Commits a new box from `start` to `end` (board-space, opposite drag
   * corners) and switches back to the select tool - same one-shot pattern
   * and same layout-preserving reasoning as `addArrow`. */
  addBox: (start: Point, end: Point) => void
  /** Creates a new text node (`id: null`) or re-commits an existing one after
   * a re-edit, in both cases with `frame` already reflecting the final
   * wrapped height - BoardCanvas computes that via `wrapText`/`textHeight`
   * (render/text.ts) using the same measurement `drawText` uses, since the
   * store itself stays free of any canvas/DOM dependency (unlike geometry,
   * text layout needs a real `measureText`, which only the caller has).
   * Trimmed-empty text creates nothing (`id: null`) or deletes the node
   * (`id` given) - same "a stray click creates nothing" rule arrow/box use,
   * extended to "an emptied-out text box doesn't linger as a blank
   * annotation." Does not switch `tool` - unlike `addArrow`/`addBox`,
   * BoardCanvas already reverts to `'select'` the instant the text draft is
   * placed, before the user has typed anything. */
  /** `size` is only ever passed when a re-edit is also changing the font
   * size (see `setNodeSize` below, which routes text through here instead
   * of mutating it directly) - BoardCanvas has already recomputed `frame`'s
   * height to match, for the same "store stays free of canvas/DOM"
   * reasoning as the note above. Omitted, the node's existing size is kept. */
  commitText: (id: NodeId | null, frame: Rect, text: string, size?: number) => void
  /** Commits a new marker at `point` (board-space) and switches back to the
   * select tool - same one-shot pattern as `addArrow`/`addBox`, but for a
   * plain click instead of a drag: a marker has no meaningful "size" the
   * user draws, just a place to point. Its visible number is derived at
   * render time (see `toRenderInput`), not stored here - so deleting one
   * marker just renumbers the rest, no separate counter to keep in sync.
   * Same layout-preserving reasoning as `addArrow` - does not touch `layout`. */
  addMarker: (point: Point) => void
  /** Commits a new redaction from `start` to `end` (board-space, opposite
   * drag corners) and switches back to the select tool - same one-shot
   * pattern as `addBox`, and same layout-preserving reasoning as `addArrow`. */
  addRedact: (start: Point, end: Point) => void
  /** Moves the selected nodes to the top of z-order (drawn last). Also
   * relayouts, since `order` doubles as layout position for auto boards -
   * same overload `reorder` already relies on for drag-to-reorder. */
  bringToFront: () => void
  /** Recolors an already-placed annotation node directly - the settings
   * popover opened from `SelectionToolbar` for a single selected annotation
   * uses this, as opposed to `setToolColor`, which only ever affects the
   * *next* one drawn (`toolSettings`). A no-op for an image (no `color`
   * field) or an id that no longer exists. */
  setNodeColor: (id: NodeId, color: string) => void
  /** Resizes an already-placed arrow/box/marker node directly, clamped to
   * the same range its tool uses - same "edit the node, not the tool
   * default" distinction as `setNodeColor`. A marker has no `size` field
   * (see `MarkerNode`'s own note); its `frame` is recentered on the
   * unchanged center point instead. Text is deliberately excluded - a font
   * size change also changes wrapped height, which needs a real
   * `measureText` only the caller has, so BoardCanvas routes that through
   * `commitText` instead. Redact has no size dimension at all. */
  setNodeSize: (id: NodeId, size: number) => void
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

/** Recomputes frames and canvas size from the current image nodes.
 * Annotations (arrow/box/text/marker/redact) are never part of the layout -
 * their geometry is absolute board-space points/rects the user placed by
 * hand, same as a manually-moved image's frame - so the final `nodes.map`
 * below only ever rewrites `kind === 'image'` frames and passes every other
 * node through untouched. That's also why adding an annotation (see
 * `addArrow` etc.) never needs to touch `layout`: this function already
 * ignores non-image nodes on an `'auto'`/`'rows'`/etc. board, so images keep
 * auto-arranging exactly as if the annotation weren't there. */
function relayout(board: Board): Board {
  if (board.layout === 'free') return board
  const items = board.nodes
    .filter((n): n is ImageNode => n.kind === 'image')
    .sort((a, b) => a.order - b.order)
    .map((n) => {
      const nat = assetStore.get(n.assetId)?.natural ?? { w: 16, h: 9 }
      // A cropped node's *layout* aspect ratio must be the cropped one, not
      // the source's - otherwise a later relayout (or turning auto back on)
      // would size the frame from the full image while `crop` still only
      // shows a sub-rect of it, stretching that sub-rect to the wrong shape.
      const natural = n.crop ? { w: nat.w * n.crop.w, h: nat.h * n.crop.h } : nat
      return { id: n.id, natural }
    })

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
    nodes: board.nodes.map((n) => (n.kind === 'image' ? { ...n, frame: result.frames[n.id] ?? n.frame } : n)),
  }
}

/** After a manual move/resize, keeps the canvas exactly as large as the
 * content needs plus `padding` on every edge - the same tight fit
 * `finalize()` already guarantees for every auto layout. Without this,
 * `board.size` stays frozen at whatever it was when the board last left auto
 * mode (invariant 4 only protects frames, not size), so rearranging into a
 * visually tighter shape - e.g. collapsing two stacked rows into one short
 * row - leaves the old, taller canvas behind as dead space: wasted margin
 * in every exported/copied image. Translating every node by the same
 * (dx, dy) preserves the arrangement the user actually made - only the
 * shared canvas origin moves, exactly like `finalize()` already does to an
 * auto layout's own arbitrary internal coordinates. */
function fitBoardToContent(board: Board): Board {
  if (board.nodes.length === 0) return board
  const bounds = boundsOf(board.nodes.map((n) => n.frame))
  const dx = board.padding - bounds.x
  const dy = board.padding - bounds.y
  const size = { w: Math.round(bounds.w + board.padding * 2), h: Math.round(bounds.h + board.padding * 2) }
  if (dx === 0 && dy === 0 && size.w === board.size.w && size.h === board.size.h) return board
  return {
    ...board,
    size,
    nodes: board.nodes.map((n) => {
      const frame = translate(n.frame, dx, dy)
      return n.kind === 'arrow'
        ? { ...n, frame, start: translatePoint(n.start, dx, dy), end: translatePoint(n.end, dx, dy) }
        : { ...n, frame }
    }),
  }
}

/** Every assetId used by any of these boards is "reachable" and must stay
 * decoded - see `AssetStore.reconcile`. Arrows have no assetId. */
function reconcileAssets(boards: Board[]): void {
  const counts = new Map<string, number>()
  for (const b of boards) {
    for (const n of b.nodes) {
      if (n.kind !== 'image') continue
      counts.set(n.assetId, (counts.get(n.assetId) ?? 0) + 1)
    }
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
  // `lastCleared` can outlive its source board's place in `past` once
  // MAX_HISTORY evicts it - it's still shown (and restorable) in the UI
  // until dismissed, so it counts as reachable too.
  const extra = s.lastCleared ? [s.lastCleared] : []
  if (s.adjustmentBase) {
    reconcileAssets([board, s.adjustmentBase, ...s.past, ...s.future, ...extra])
    return { board, past: s.past, future: s.future }
  }
  const past = [...s.past, s.board].slice(-MAX_HISTORY)
  reconcileAssets([board, ...past, ...extra])
  return { board, past, future: [] }
}

/** Every commit path (including undo/redo, which build their own return
 * value instead of calling `commitBoard`) runs through this so autosave
 * never has a mutation that silently skips it. */
function autosave(board: Board): void {
  scheduleAutosave(board, (assetId) => assetStore.get(assetId)?.blob)
}

/** Shared by `hydrate`'s two IndexedDB-backed recovery paths (the normal
 * autosave and the last-cleared snapshot): decodes a board's blobs back
 * through the asset pipeline and drops any node whose image didn't survive,
 * same as a corrupt store would be handled either way. Returns null if
 * nothing decodable is left - not worth surfacing as a recovery option. */
async function decodeBoardAssets(board: Board, blobs: Map<string, Blob>): Promise<Board | null> {
  const imageNodes = board.nodes.filter((n): n is ImageNode => n.kind === 'image')
  const uniqueIds = [...new Set(imageNodes.map((n) => n.assetId))]
  const decoded = new Map<string, Asset>()
  await Promise.all(
    uniqueIds.map(async (id) => {
      const blob = blobs.get(id)
      if (!blob) return
      const asset = await assetStore.restore(id, blob)
      if (asset) decoded.set(id, asset)
    }),
  )
  // Arrows carry no asset to fail decoding - only images can drop out here.
  const nodes = board.nodes.filter((n) => n.kind !== 'image' || decoded.has(n.assetId))
  if (nodes.length === 0) return null
  const result: Board =
    nodes.length === board.nodes.length ? board : relayout({ ...board, nodes: nodes.map((n, i) => ({ ...n, order: i })) })
  for (const n of result.nodes) {
    const match = /^n(\d+)$/.exec(n.id)
    if (match) nodeSeq = Math.max(nodeSeq, Number(match[1]) + 1)
  }
  return result
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
  lastCleared: null,
  tool: 'select',
  toolSettings: DEFAULT_TOOL_SETTINGS,

  async hydrate() {
    const restored = await restoreAutosave()
    const recovered = restored ? await decodeBoardAssets(restored.board, restored.assets) : null

    if (recovered) {
      reconcileAssets([recovered])
      set({ board: recovered, recoveredBoard: recovered })
      // A real (non-empty) board is back in play, so whatever `clear()`
      // emptied before this reload is moot - drop the stale snapshot.
      wipeLastCleared()
      return
    }

    // Otherwise decode any last-cleared snapshot the same way and offer it
    // through `lastCleared`, same as if the tab had never closed.
    const clearedSnapshot = await restoreLastClearedFromDB()
    const lastCleared = clearedSnapshot ? await decodeBoardAssets(clearedSnapshot.board, clearedSnapshot.assets) : null
    if (lastCleared) {
      reconcileAssets([get().board, lastCleared])
      set({ lastCleared })
    }
  },

  dismissRecovery: () => set({ recoveredBoard: null }),

  restoreLastCleared: () =>
    set((s) => {
      const board = s.lastCleared
      if (!board) return {}
      wipeLastCleared()
      return { ...commitBoard(s, board), lastCleared: null }
    }),

  dismissLastCleared: () => {
    wipeLastCleared()
    set({ lastCleared: null })
  },

  startFresh: () =>
    set((s) => {
      wipeAutosave() // also wipes the last-cleared IndexedDB record (clearAllRecords)
      return {
        ...commitBoard(s, { ...DEFAULT_BOARD, nodes: [] }),
        selectedIds: [],
        recoveredBoard: null,
        lastCleared: null,
      }
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

  clear: () =>
    set((s) => {
      // Fire-and-forget, like autosave itself - the snapshot is a misclick
      // safety net, not something Clear should ever wait on. Uses the assets
      // already decoded in memory rather than a later IndexedDB read, since
      // the autosave this same commit schedules will, 800ms from now, diff
      // the emptied board and delete every asset this snapshot needs.
      if (s.board.nodes.length > 0) {
        void saveLastCleared(s.board, (assetId) => assetStore.get(assetId)?.blob)
      }
      return {
        ...commitBoard(s, { ...DEFAULT_BOARD, nodes: [] }),
        selectedIds: [],
        lastCleared: s.board.nodes.length > 0 ? s.board : s.lastCleared,
        // Superseded by the more specific "Board cleared" bar above.
        recoveredBoard: null,
      }
    }),

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
      return commitBoard(
        s,
        fitBoardToContent({
          ...s.board,
          layout: 'free',
          nodes: s.board.nodes.map((n) => {
            const frame = byId.get(n.id)
            if (!frame) return n
            // An arrow's frame is only ever moved wholesale (see handles.ts -
            // arrows never expose a resize handle), so the delta between old
            // and new frame origin is the same translation to apply to its
            // actual start/end points.
            if (n.kind === 'arrow') {
              const dx = frame.x - n.frame.x
              const dy = frame.y - n.frame.y
              return { ...n, frame, start: translatePoint(n.start, dx, dy), end: translatePoint(n.end, dx, dy) }
            }
            return { ...n, frame }
          }),
        }),
      )
    }),

  commitCrop: (id, frame, crop) =>
    set((s) =>
      commitBoard(s, {
        ...s.board,
        layout: 'free',
        nodes: s.board.nodes.map((n) => (n.id === id && n.kind === 'image' ? { ...n, frame, crop } : n)),
      }),
    ),

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
      const nodes: BoardNode[] = []
      const newIds: NodeId[] = []
      for (const n of sorted) {
        nodes.push(n)
        if (ids.has(n.id)) {
          const frame = translate(n.frame, DUPLICATE_OFFSET, DUPLICATE_OFFSET)
          const copy: BoardNode =
            n.kind === 'arrow'
              ? {
                  ...n,
                  id: `n${nodeSeq++}`,
                  frame,
                  start: translatePoint(n.start, DUPLICATE_OFFSET, DUPLICATE_OFFSET),
                  end: translatePoint(n.end, DUPLICATE_OFFSET, DUPLICATE_OFFSET),
                }
              : { ...n, id: `n${nodeSeq++}`, frame }
          nodes.push(copy)
          newIds.push(copy.id)
        }
      }
      return {
        ...commitBoard(s, relayout({ ...s.board, nodes: nodes.map((n, i) => ({ ...n, order: i })) })),
        selectedIds: newIds,
      }
    }),

  setTool: (tool) => set({ tool }),

  setToolColor: (tool, color) =>
    set((s) => ({ toolSettings: { ...s.toolSettings, [tool]: { ...s.toolSettings[tool], color } } })),

  setToolSize: (tool, size) =>
    set((s) => ({
      toolSettings: { ...s.toolSettings, [tool]: { ...s.toolSettings[tool], size: clampAnnotationSize(tool, size) } },
    })),

  adjustToolSize: (tool, delta) =>
    set((s) => ({
      toolSettings: {
        ...s.toolSettings,
        [tool]: { ...s.toolSettings[tool], size: clampAnnotationSize(tool, s.toolSettings[tool].size + delta) },
      },
    })),

  addArrow: (start, end) =>
    set((s) => {
      const arrow: ArrowNode = {
        kind: 'arrow',
        id: `n${nodeSeq++}`,
        frame: arrowFrame(start, end),
        order: s.board.nodes.length,
        start,
        end,
        color: s.toolSettings.arrow.color,
        size: s.toolSettings.arrow.size,
      }
      return {
        ...commitBoard(s, { ...s.board, nodes: [...s.board.nodes, arrow] }),
        selectedIds: [arrow.id],
        tool: 'select',
      }
    }),

  addBox: (start, end) =>
    set((s) => {
      const box: BoxNode = {
        kind: 'box',
        id: `n${nodeSeq++}`,
        frame: rectFromPoints(start, end),
        order: s.board.nodes.length,
        color: s.toolSettings.box.color,
        size: s.toolSettings.box.size,
      }
      return {
        ...commitBoard(s, { ...s.board, nodes: [...s.board.nodes, box] }),
        selectedIds: [box.id],
        tool: 'select',
      }
    }),

  commitText: (id, frame, text, size) =>
    set((s) => {
      const trimmed = text.trim()
      if (id === null) {
        if (trimmed === '') return {}
        const node: TextNode = {
          kind: 'text',
          id: `n${nodeSeq++}`,
          frame,
          order: s.board.nodes.length,
          text,
          color: s.toolSettings.text.color,
          size: s.toolSettings.text.size,
        }
        return {
          ...commitBoard(s, { ...s.board, nodes: [...s.board.nodes, node] }),
          selectedIds: [node.id],
        }
      }
      if (trimmed === '') {
        const remaining = [...s.board.nodes].filter((n) => n.id !== id).sort((a, b) => a.order - b.order)
        return {
          ...commitBoard(s, relayout({ ...s.board, nodes: remaining.map((n, i) => ({ ...n, order: i })) })),
          selectedIds: s.selectedIds.filter((x) => x !== id),
        }
      }
      return commitBoard(s, {
        ...s.board,
        nodes: s.board.nodes.map((n) => (n.id === id && n.kind === 'text' ? { ...n, frame, text, size: size ?? n.size } : n)),
      })
    }),

  addMarker: (point) =>
    set((s) => {
      const marker: MarkerNode = {
        kind: 'marker',
        id: `n${nodeSeq++}`,
        frame: markerFrame(point, s.toolSettings.marker.size),
        order: s.board.nodes.length,
        color: s.toolSettings.marker.color,
      }
      return {
        ...commitBoard(s, { ...s.board, nodes: [...s.board.nodes, marker] }),
        selectedIds: [marker.id],
        tool: 'select',
      }
    }),

  addRedact: (start, end) =>
    set((s) => {
      const redact: RedactNode = {
        kind: 'redact',
        id: `n${nodeSeq++}`,
        frame: rectFromPoints(start, end),
        order: s.board.nodes.length,
        color: s.toolSettings.redact.color,
      }
      return {
        ...commitBoard(s, { ...s.board, nodes: [...s.board.nodes, redact] }),
        selectedIds: [redact.id],
        tool: 'select',
      }
    }),

  bringToFront: () =>
    set((s) => {
      if (s.selectedIds.length === 0) return {}
      const sorted = [...s.board.nodes].sort((a, b) => a.order - b.order)
      const reordered = moveToFront(sorted, new Set(s.selectedIds))
      return commitBoard(s, relayout({ ...s.board, nodes: reordered.map((n, i) => ({ ...n, order: i })) }))
    }),

  setNodeColor: (id, color) =>
    set((s) => {
      let changed = false
      const nodes = s.board.nodes.map((n) => {
        if (n.id !== id || n.kind === 'image') return n
        changed = true
        return { ...n, color }
      })
      return changed ? commitBoard(s, { ...s.board, nodes }) : {}
    }),

  setNodeSize: (id, size) =>
    set((s) => {
      let changed = false
      const nodes = s.board.nodes.map((n) => {
        if (n.id !== id) return n
        if (n.kind === 'marker') {
          changed = true
          const cx = n.frame.x + n.frame.w / 2
          const cy = n.frame.y + n.frame.h / 2
          return { ...n, frame: markerFrame({ x: cx, y: cy }, clampAnnotationSize('marker', size)) }
        }
        if (n.kind === 'arrow' || n.kind === 'box') {
          changed = true
          return { ...n, size: clampAnnotationSize(n.kind, size) }
        }
        return n
      })
      return changed ? commitBoard(s, { ...s.board, nodes }) : {}
    }),

  undo: () =>
    set((s) => {
      const previous = s.past[s.past.length - 1]
      if (!previous) return {}
      const past = s.past.slice(0, -1)
      const future = [...s.future, s.board]
      reconcileAssets([previous, ...past, ...future, ...(s.lastCleared ? [s.lastCleared] : [])])
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
      reconcileAssets([next, ...past, ...future, ...(s.lastCleared ? [s.lastCleared] : [])])
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
      reconcileAssets([s.board, ...past, ...(s.lastCleared ? [s.lastCleared] : [])])
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

/** Adapts board state into the renderer's input, using display-resolution
 * bitmaps. Step badges number only the images, in order - filtering before
 * indexing keeps that true now that arrows can also live in `board.nodes`. */
export function toRenderInput(board: Board): RenderInput {
  const sorted = [...board.nodes].sort((a, b) => a.order - b.order)
  return {
    size: board.size,
    background: board.background,
    style: board.style,
    items: sorted
      .filter((n): n is ImageNode => n.kind === 'image')
      .map((n, i) => ({
        id: n.id,
        frame: n.frame,
        image: assetStore.get(n.assetId)?.display ?? null,
        ...(n.crop ? { crop: n.crop } : {}),
        ...(board.resolvedLayout === 'steps' ? { badge: i + 1 } : {}),
      })),
    arrows: sorted
      .filter((n): n is ArrowNode => n.kind === 'arrow')
      .map((n) => ({ id: n.id, start: n.start, end: n.end, color: n.color, size: n.size })),
    boxes: sorted
      .filter((n): n is BoxNode => n.kind === 'box')
      .map((n) => ({ id: n.id, frame: n.frame, color: n.color, size: n.size })),
    texts: sorted
      .filter((n): n is TextNode => n.kind === 'text')
      .map((n) => ({ id: n.id, frame: n.frame, text: n.text, color: n.color, size: n.size })),
    // Numbered by placement order among markers only, same "index among
    // same-kind nodes" rule the image step badges above already use.
    markers: sorted
      .filter((n): n is MarkerNode => n.kind === 'marker')
      .map((n, i) => ({ id: n.id, frame: n.frame, number: i + 1, color: n.color })),
    redacts: sorted
      .filter((n): n is RedactNode => n.kind === 'redact')
      .map((n) => ({ id: n.id, frame: n.frame, color: n.color })),
  }
}
