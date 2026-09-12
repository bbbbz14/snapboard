import type { Board } from '@/board/model/types'

/**
 * Bare IndexedDB wrapper - two object stores, no library. Everything above
 * this file works with plain values (`Board`, `Blob`); this is the only
 * place that touches `indexedDB` directly, so `autosave.ts` stays testable
 * against fake-indexeddb and the rest of the app never has to think about
 * transactions.
 */

const DB_NAME = 'snapboard'
const DB_VERSION = 2
const BOARD_STORE = 'board'
const ASSET_STORE = 'assets'
const LAST_CLEARED_STORE = 'lastCleared'
const BOARD_KEY = 'current'
const LAST_CLEARED_KEY = 'snapshot'

export interface StoredAsset {
  id: string
  blob: Blob
  refs: number
}

/** IndexedDB's own on-disk shape: an ArrayBuffer + mime type rather than a
 * live Blob. Headless WebKit's IndexedDB throws ("Error preparing Blob/File
 * data to be stored in object store") when a Blob is put directly - storing
 * the bytes ourselves sidesteps its Blob structured-clone path entirely. */
interface StoredAssetRecord {
  id: string
  data: ArrayBuffer
  type: string
  refs: number
}

/** A single one-shot snapshot of the board `clear()` just emptied, plus the
 * bytes of every asset it referenced - stored separately from the live
 * `board`/`assets` records so the normal autosave diff (which deletes any
 * asset no longer referenced by the *current*, now-empty board) can't race
 * it away. Bundled as one record, not the assets table's per-id rows: this
 * only ever needs to hold exactly one snapshot, never a history. */
interface LastClearedRecord {
  board: Board
  assets: { id: string; data: ArrayBuffer; type: string }[]
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BOARD_STORE)) db.createObjectStore(BOARD_STORE)
      if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(LAST_CLEARED_STORE)) db.createObjectStore(LAST_CLEARED_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function getBoardRecord(): Promise<Board | null> {
  const db = await openDB()
  const tx = db.transaction(BOARD_STORE, 'readonly')
  const result = await wrap(tx.objectStore(BOARD_STORE).get(BOARD_KEY))
  return (result as Board | undefined) ?? null
}

export async function putBoardRecord(board: Board): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(BOARD_STORE, 'readwrite')
  tx.objectStore(BOARD_STORE).put(board, BOARD_KEY)
  await done(tx)
}

export async function getAssetRecord(id: string): Promise<StoredAsset | null> {
  const db = await openDB()
  const tx = db.transaction(ASSET_STORE, 'readonly')
  const result = (await wrap(tx.objectStore(ASSET_STORE).get(id))) as StoredAssetRecord | undefined
  if (!result) return null
  return { id: result.id, blob: new Blob([result.data], { type: result.type }), refs: result.refs }
}

export async function putAssetRecord(record: StoredAsset): Promise<void> {
  const data = await record.blob.arrayBuffer()
  const db = await openDB()
  const tx = db.transaction(ASSET_STORE, 'readwrite')
  tx.objectStore(ASSET_STORE).put({ id: record.id, data, type: record.blob.type, refs: record.refs } satisfies StoredAssetRecord)
  await done(tx)
}

export async function deleteAssetRecord(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(ASSET_STORE, 'readwrite')
  tx.objectStore(ASSET_STORE).delete(id)
  await done(tx)
}

export async function clearAllRecords(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([BOARD_STORE, ASSET_STORE, LAST_CLEARED_STORE], 'readwrite')
  tx.objectStore(BOARD_STORE).delete(BOARD_KEY)
  tx.objectStore(ASSET_STORE).clear()
  tx.objectStore(LAST_CLEARED_STORE).delete(LAST_CLEARED_KEY)
  await done(tx)
}

export interface StoredLastCleared {
  board: Board
  assets: { id: string; blob: Blob }[]
}

export async function putLastClearedRecord(board: Board, assets: { id: string; blob: Blob }[]): Promise<void> {
  const data = await Promise.all(
    assets.map(async (a) => ({ id: a.id, data: await a.blob.arrayBuffer(), type: a.blob.type })),
  )
  const db = await openDB()
  const tx = db.transaction(LAST_CLEARED_STORE, 'readwrite')
  tx.objectStore(LAST_CLEARED_STORE).put({ board, assets: data } satisfies LastClearedRecord, LAST_CLEARED_KEY)
  await done(tx)
}

export async function getLastClearedRecord(): Promise<StoredLastCleared | null> {
  const db = await openDB()
  const tx = db.transaction(LAST_CLEARED_STORE, 'readonly')
  const result = (await wrap(tx.objectStore(LAST_CLEARED_STORE).get(LAST_CLEARED_KEY))) as
    | LastClearedRecord
    | undefined
  if (!result) return null
  return {
    board: result.board,
    assets: result.assets.map((a) => ({ id: a.id, blob: new Blob([a.data], { type: a.type }) })),
  }
}

export async function clearLastClearedRecord(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(LAST_CLEARED_STORE, 'readwrite')
  tx.objectStore(LAST_CLEARED_STORE).delete(LAST_CLEARED_KEY)
  await done(tx)
}
