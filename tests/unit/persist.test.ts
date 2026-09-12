import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_BOARD, type Board, type ImageNode } from '@/board/model/types'
import { clearAllRecords, getAssetRecord, getBoardRecord } from '@/board/persist/db'
import {
  restoreAutosave,
  restoreLastCleared,
  saveLastCleared,
  scheduleAutosave,
  wipeAutosave,
  wipeLastCleared,
} from '@/board/persist/autosave'

// scheduleAutosave debounces for 800ms (src/board/persist/autosave.ts) - fake
// timers don't mix reliably with fake-indexeddb's own internal scheduling,
// so these use real (short) waits instead. BELOW/PAST straddle that window.
const BELOW_DEBOUNCE = 400
const PAST_DEBOUNCE = 900
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function node(id: string, assetId: string): ImageNode {
  return { kind: 'image', id, assetId, order: 0, frame: { x: 0, y: 0, w: 10, h: 10 } }
}

function board(nodes: ImageNode[]): Board {
  return { ...DEFAULT_BOARD, nodes }
}

// One IndexedDB connection lives for the whole file (same as the app's own
// lifetime) - `wipeAutosave` also resets autosave's "which asset ids are
// already on disk" cache, so each test starts from the same clean slate.
beforeEach(async () => {
  wipeAutosave()
  await clearAllRecords()
})

describe('scheduleAutosave / db round trip', () => {
  it('writes nothing until the debounce window elapses', async () => {
    const b = board([node('n0', 'a0')])
    scheduleAutosave(b, () => new Blob(['a']))

    await sleep(BELOW_DEBOUNCE)
    expect(await getBoardRecord()).toBeNull()

    await sleep(PAST_DEBOUNCE)
    expect(await getBoardRecord()).toEqual(b)
  }, 10000)

  it('debounces: a call inside the window resets the timer', async () => {
    const b = board([node('n0', 'a0')])
    const getBlob = () => new Blob(['a'])

    scheduleAutosave(b, getBlob)
    await sleep(BELOW_DEBOUNCE)
    scheduleAutosave(b, getBlob) // resets the window - only BELOW_DEBOUNCE ms have really passed
    await sleep(BELOW_DEBOUNCE)
    expect(await getBoardRecord()).toBeNull()

    await sleep(PAST_DEBOUNCE)
    expect(await getBoardRecord()).toEqual(b)
  }, 10000)

  it('writes a new asset once and deletes it once nothing references it', async () => {
    const blobs: Record<string, Blob> = { a0: new Blob(['a']), a1: new Blob(['b']) }
    const getBlob = (id: string) => blobs[id]

    scheduleAutosave(board([node('n0', 'a0')]), getBlob)
    await sleep(PAST_DEBOUNCE)
    expect(await getAssetRecord('a0')).toMatchObject({ id: 'a0', refs: 1 })

    scheduleAutosave(board([node('n0', 'a1')]), getBlob)
    await sleep(PAST_DEBOUNCE)
    expect(await getAssetRecord('a0')).toBeNull()
    expect(await getAssetRecord('a1')).toMatchObject({ id: 'a1', refs: 1 })
  }, 10000)

  it('keeps a shared asset once, with refs matching how many nodes use it', async () => {
    const blob = new Blob(['a'])
    scheduleAutosave(board([node('n0', 'a0'), node('n1', 'a0')]), () => blob)
    await sleep(PAST_DEBOUNCE)
    expect(await getAssetRecord('a0')).toMatchObject({ id: 'a0', refs: 2 })
  }, 10000)
})

describe('restoreAutosave', () => {
  it('returns null when nothing was ever saved', async () => {
    expect(await restoreAutosave()).toBeNull()
  })

  it('returns null for a saved-but-empty board (nothing worth recovering)', async () => {
    scheduleAutosave(board([]), () => new Blob(['a']))
    await sleep(PAST_DEBOUNCE)
    expect(await restoreAutosave()).toBeNull()
  }, 10000)

  it('returns the saved board and its blobs, keyed by assetId', async () => {
    const blob = new Blob(['a'])
    scheduleAutosave(board([node('n0', 'a0')]), () => blob)
    await sleep(PAST_DEBOUNCE)

    const restored = await restoreAutosave()
    expect(restored?.board.nodes.map((n) => n.id)).toEqual(['n0'])
    expect(restored?.assets.get('a0')).toStrictEqual(blob)
  }, 10000)
})

describe('saveLastCleared / restoreLastCleared', () => {
  it('writes immediately, not debounced', async () => {
    const b = board([node('n0', 'a0')])
    await saveLastCleared(b, () => new Blob(['a']))
    const restored = await restoreLastCleared()
    expect(restored?.board.nodes.map((n) => n.id)).toEqual(['n0'])
  })

  it('is unaffected by the normal autosave diff deleting the same assetId', async () => {
    // Mirrors the real sequence: clear() saves the snapshot, then the
    // scheduled autosave for the now-empty board runs and would otherwise
    // delete asset a0 from the live `assets` store.
    const blob = new Blob(['a'])
    await saveLastCleared(board([node('n0', 'a0')]), () => blob)
    scheduleAutosave(board([]), () => blob)
    await sleep(PAST_DEBOUNCE)

    expect(await getAssetRecord('a0')).toBeNull()
    const restored = await restoreLastCleared()
    expect(restored?.assets.get('a0')).toStrictEqual(blob)
  }, 10000)

  it('does nothing for an already-empty board', async () => {
    await saveLastCleared(board([]), () => new Blob(['a']))
    expect(await restoreLastCleared()).toBeNull()
  })

  it('returns null once wiped', async () => {
    await saveLastCleared(board([node('n0', 'a0')]), () => new Blob(['a']))
    wipeLastCleared()
    await sleep(BELOW_DEBOUNCE)
    expect(await restoreLastCleared()).toBeNull()
  })
})

describe('wipeAutosave', () => {
  it('cancels a pending debounced write and clears storage immediately', async () => {
    scheduleAutosave(board([node('n0', 'a0')]), () => new Blob(['a']))
    wipeAutosave()
    await sleep(PAST_DEBOUNCE)
    expect(await getBoardRecord()).toBeNull()
  }, 10000)

  it('lets a later save re-write an asset id it just wiped', async () => {
    const blob = new Blob(['a'])
    scheduleAutosave(board([node('n0', 'a0')]), () => blob)
    await sleep(PAST_DEBOUNCE)

    wipeAutosave()
    await sleep(BELOW_DEBOUNCE)
    expect(await getAssetRecord('a0')).toBeNull()

    scheduleAutosave(board([node('n0', 'a0')]), () => blob)
    await sleep(PAST_DEBOUNCE)
    expect(await getAssetRecord('a0')).toMatchObject({ id: 'a0' })
  }, 10000)

  it('also wipes any pending last-cleared snapshot (clearAllRecords covers both stores)', async () => {
    await saveLastCleared(board([node('n0', 'a0')]), () => new Blob(['a']))
    wipeAutosave()
    expect(await restoreLastCleared()).toBeNull()
  })
})
