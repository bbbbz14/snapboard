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
            const existing = this.#assets.get(existingId)!
            existing.refs++
            return existing
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

  release(id: string): void {
    const asset = this.#assets.get(id)
    if (!asset) return
    if (--asset.refs > 0) return
    asset.display.close()
    this.#assets.delete(id)
    for (const [hash, aid] of this.#byHash) {
      if (aid === id) this.#byHash.delete(hash)
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
