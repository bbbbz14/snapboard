import type { Size } from '@/lib/geometry'
import { checkFile, checkPixels, sniffType, type Rejection } from './validate'
import type { DecodeRequest, DecodeResponse } from './decode.worker'

export interface Asset {
  id: string
  /** Original bytes, kept for full-quality export. */
  blob: Blob
  natural: Size
  /** Downscaled copy used for on-screen drawing. Full-res would cost 3.5x the memory (ADR-004). */
  display: ImageBitmap
  refs: number
}

/** Longest edge kept in memory for display. 20 4K shots: 664MB full-res vs 189MB here. */
export const DISPLAY_MAX_DIM = 2048
/** Decoding more than this at once starves the UI on slower engines. */
const CONCURRENCY = 4

export interface IngestResult {
  assets: Asset[]
  rejected: Rejection[]
}

export class AssetStore {
  #assets = new Map<string, Asset>()
  #byHash = new Map<string, string>()
  #worker: Worker | null = null
  #pending = new Map<string, (r: DecodeResponse) => void>()
  #seq = 0

  #getWorker(): Worker {
    if (!this.#worker) {
      this.#worker = new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' })
      this.#worker.onmessage = (e: MessageEvent<DecodeResponse>) => {
        this.#pending.get(e.data.id)?.(e.data)
        this.#pending.delete(e.data.id)
      }
    }
    return this.#worker
  }

  #decode(blob: Blob): Promise<DecodeResponse> {
    const id = `d${this.#seq++}`
    return new Promise((resolve) => {
      this.#pending.set(id, resolve)
      this.#getWorker().postMessage({ id, blob, maxDim: DISPLAY_MAX_DIM } satisfies DecodeRequest)
    })
  }

  get(id: string): Asset | undefined {
    return this.#assets.get(id)
  }

  /**
   * Validates, deduplicates and decodes a batch of files.
   * Rejections are returned rather than thrown — one bad file must never
   * discard the good ones the user dropped alongside it.
   */
  async ingest(files: File[], onProgress?: (done: number, total: number) => void): Promise<IngestResult> {
    const rejected: Rejection[] = []
    const accepted: File[] = []

    for (const file of files) {
      const reason = checkFile(file)
      if (reason) rejected.push({ name: file.name || file.type, reason })
      else accepted.push(file)
    }

    const assets: Asset[] = []
    let done = 0

    for (let i = 0; i < accepted.length; i += CONCURRENCY) {
      const batch = accepted.slice(i, i + CONCURRENCY)
      const settled = await Promise.all(
        batch.map(async (file): Promise<Asset | Rejection> => {
          const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
          if (!sniffType(head)) return { name: file.name, reason: 'corrupt' }

          const hash = await hashBlob(file)
          const existingId = this.#byHash.get(hash)
          if (existingId) {
            return this.#assets.get(existingId)!
          }

          const res = await this.#decode(file)
          if (!res.ok || !res.display || !res.natural) return { name: file.name, reason: 'corrupt' }

          const tooBig = checkPixels(res.natural.w, res.natural.h)
          if (tooBig) {
            res.display.close()
            return { name: file.name, reason: tooBig }
          }

          const asset: Asset = {
            id: `a${this.#seq++}`,
            blob: file,
            natural: res.natural,
            display: res.display,
            refs: 1,
          }
          this.#assets.set(asset.id, asset)
          this.#byHash.set(hash, asset.id)
          return asset
        }),
      )

      for (const r of settled) {
        if ('reason' in r) rejected.push(r)
        else assets.push(r)
      }
      done += batch.length
      onProgress?.(done, accepted.length)
    }

    return { assets, rejected }
  }

  /**
   * Re-decodes a Blob read back from autosave into an asset keyed by its
   * *original* id, so restored `Board.nodes[].assetId` references keep
   * resolving without the board itself needing to change. Returns null if
   * the bytes no longer decode (corrupt store) - the caller drops the node
   * rather than leaving it pointing at nothing forever.
   */
  async restore(id: string, blob: Blob): Promise<Asset | null> {
    const existing = this.#assets.get(id)
    if (existing) return existing

    const res = await this.#decode(blob)
    if (!res.ok || !res.display || !res.natural) return null

    const asset: Asset = { id, blob, natural: res.natural, display: res.display, refs: 1 }
    this.#assets.set(id, asset)
    this.#byHash.set(await hashBlob(blob), id)
    this.#bumpSeqPast(id)
    return asset
  }

  /** Keeps future `a${seq++}` ids from colliding with one just restored
   * from autosave (e.g. board has "a7", next fresh ingest must not reuse it). */
  #bumpSeqPast(id: string): void {
    const match = /^a(\d+)$/.exec(id)
    if (match) this.#seq = Math.max(this.#seq, Number(match[1]) + 1)
  }

  /** Decodes the original bytes at full resolution for export, then releases them. */
  async fullRes(id: string): Promise<ImageBitmap | null> {
    const asset = this.#assets.get(id)
    if (!asset) return null
    try {
      return await createImageBitmap(asset.blob)
    } catch {
      return null
    }
  }

  /**
   * Sets each asset's refcount to its occurrence count in `counts` and frees
   * any asset that drops to zero. Called with the assetIds used across every
   * board reachable from the current one - the live board plus all of undo
   * history and the redo stack - so an image a node still references from a
   * past or future snapshot survives, and only becomes unreachable (and gets
   * its ImageBitmap closed) once no history entry needs it anymore.
   */
  reconcile(counts: Map<string, number>): void {
    for (const [id, asset] of [...this.#assets]) {
      const want = counts.get(id) ?? 0
      if (want > 0) {
        asset.refs = want
        continue
      }
      asset.display.close()
      this.#assets.delete(id)
      for (const [hash, aid] of this.#byHash) {
        if (aid === id) this.#byHash.delete(hash)
      }
    }
  }

  dispose(): void {
    for (const a of this.#assets.values()) a.display.close()
    this.#assets.clear()
    this.#byHash.clear()
    this.#worker?.terminate()
    this.#worker = null
  }
}

async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
