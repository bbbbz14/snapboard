import type { Board, ImageNode } from '@/board/model/types'
import {
  clearAllRecords,
  clearLastClearedRecord,
  deleteAssetRecord,
  getAssetRecord,
  getBoardRecord,
  getLastClearedRecord,
  putAssetRecord,
  putBoardRecord,
  putLastClearedRecord,
} from './db'

/** Product plan 8.2: debounce so a continuous gesture (the gap slider, a
 * drag) doesn't write on every tick - one write ~800ms after things go
 * quiet is enough to survive an accidental tab close. */
const DEBOUNCE_MS = 800

let timer: ReturnType<typeof setTimeout> | null = null

/** AssetIds this module has already confirmed are written to IDB. A save
 * that neither adds nor drops an image only has to write the (cheap) board
 * record - re-writing every image's Blob on every autosave would be the
 * kind of quiet perf cliff this codebase keeps a list of (see CLAUDE.md
 * gotchas). Reset on restore/wipe so it always reflects what's really on
 * disk. */
let knownAssetIds = new Set<string>()

/** IndexedDB can be missing or disabled (Safari private browsing) - autosave
 * degrades to a no-op rather than throwing, the same "nice-to-have, not a
 * hard dependency" treatment ADR-003 gives clipboard.write(). */
function available(): boolean {
  return typeof indexedDB !== 'undefined'
}

export function scheduleAutosave(board: Board, getBlob: (assetId: string) => Blob | undefined): void {
  if (!available()) return
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void persist(board, getBlob)
  }, DEBOUNCE_MS)
}

/** Autosave is best-effort - a quota error or any other storage failure
 * should never surface as an unhandled rejection (this runs fire-and-forget
 * from a setTimeout) or break the session that's still open in memory. */
async function persist(board: Board, getBlob: (assetId: string) => Blob | undefined): Promise<void> {
  try {
    const counts = new Map<string, number>()
    for (const n of board.nodes) {
      if (n.kind !== 'image') continue
      counts.set(n.assetId, (counts.get(n.assetId) ?? 0) + 1)
    }

    await putBoardRecord(board)

    for (const id of [...knownAssetIds]) {
      if (!counts.has(id)) {
        knownAssetIds.delete(id)
        await deleteAssetRecord(id)
      }
    }
    for (const [id, refs] of counts) {
      if (knownAssetIds.has(id)) continue
      const blob = getBlob(id)
      if (!blob) continue
      knownAssetIds.add(id)
      await putAssetRecord({ id, blob, refs })
    }
  } catch {
    // Best-effort: the in-memory session is unaffected either way.
  }
}

export interface RestoredAutosave {
  board: Board
  /** Only the assetIds whose Blob actually decoded back out of IDB - a node
   * whose asset is missing gets dropped by the caller rather than shown
   * broken forever. */
  assets: Map<string, Blob>
}

/** Reads back the last autosaved board, or null if there's nothing (or
 * nothing worth recovering - an empty board isn't a "recovered your work"
 * moment). Also seeds `knownAssetIds` so the next `scheduleAutosave` diffs
 * against what's really on disk instead of an empty set. */
export async function restoreAutosave(): Promise<RestoredAutosave | null> {
  if (!available()) return null
  try {
    const board = await getBoardRecord()
    if (!board || board.nodes.length === 0) return null

    const ids = [...new Set(board.nodes.filter((n): n is ImageNode => n.kind === 'image').map((n) => n.assetId))]
    const assets = new Map<string, Blob>()
    for (const id of ids) {
      const record = await getAssetRecord(id)
      if (record) assets.set(id, record.blob)
    }
    knownAssetIds = new Set(assets.keys())
    return { board, assets }
  } catch {
    // Best-effort: fall back to the normal empty-board startup.
    return null
  }
}

/** Discards any pending debounced write and wipes storage immediately -
 * "Start fresh" is a deliberate, explicit action (invariant 4's spirit
 * applied to persistence) so it shouldn't wait 800ms to take effect. */
export function wipeAutosave(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  knownAssetIds = new Set()
  if (available()) clearAllRecords().catch(() => {})
}

/** Snapshots the board `clear()` is about to empty, plus its images, into a
 * one-off IndexedDB slot separate from the live autosave record - a misclick
 * safety net. Written immediately (not debounced): the normal autosave that
 * `clear()` also schedules will, on its own 800ms timer, diff the now-empty
 * board and delete every asset this snapshot needs, so this has to land
 * first, from real bytes still in memory, not from whatever IndexedDB has by
 * the time either write actually runs. Best-effort, like the rest of this
 * module - a storage failure here must not block the clear itself. */
export async function saveLastCleared(board: Board, getBlob: (assetId: string) => Blob | undefined): Promise<void> {
  if (!available() || board.nodes.length === 0) return
  try {
    const ids = [...new Set(board.nodes.filter((n): n is ImageNode => n.kind === 'image').map((n) => n.assetId))]
    const assets = ids
      .map((id) => ({ id, blob: getBlob(id) }))
      .filter((a): a is { id: string; blob: Blob } => a.blob !== undefined)
    await putLastClearedRecord(board, assets)
  } catch {
    // Best-effort: undo still covers the same-session case either way.
  }
}

/** Mirrors `RestoredAutosave` - the board `clear()` most recently emptied,
 * plus whichever of its images actually decoded back out of IndexedDB. */
export async function restoreLastCleared(): Promise<RestoredAutosave | null> {
  if (!available()) return null
  try {
    const record = await getLastClearedRecord()
    if (!record || record.board.nodes.length === 0) return null
    return { board: record.board, assets: new Map(record.assets.map((a) => [a.id, a.blob])) }
  } catch {
    return null
  }
}

/** Drops the snapshot once it's no longer relevant: the user restored it,
 * dismissed it, or a newer non-empty board has since been autosaved over it. */
export function wipeLastCleared(): void {
  if (available()) clearLastClearedRecord().catch(() => {})
}
