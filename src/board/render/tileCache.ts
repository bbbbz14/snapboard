import type { StylePreset } from '@/board/model/types'
import { drawFramedImage, styleMargin, type RenderItem, type Tile, type TileProvider } from './renderScene'

interface CachedTile extends Tile {
  canvas: OffscreenCanvas
  key: string
}

/**
 * Pre-renders each image node (shadow and rounding baked in) so the preview
 * loop is just N drawImage calls.
 *
 * Measured in Phase 0: drop shadows cost 72-91% of frame time, and caching
 * makes redraws 18-23x cheaper. Moving a node does not invalidate its tile -
 * only a change of size, style or resolution does. See ADR-002.
 */
export class TileCache implements TileProvider {
  #tiles = new Map<string, CachedTile>()
  #ratio: number

  constructor(ratio = 1) {
    this.#ratio = ratio
  }

  /** Device pixels per logical unit. Changing it rebuilds every tile. */
  setRatio(ratio: number): void {
    if (Math.abs(ratio - this.#ratio) < 0.001) return
    this.#ratio = ratio
    this.#tiles.clear()
  }

  get(item: RenderItem, style: StylePreset): CachedTile | null {
    if (!item.image) return null
    const key = tileKey(item, style, this.#ratio)
    const existing = this.#tiles.get(item.id)
    if (existing && existing.key === key) return existing

    const margin = styleMargin(style)
    const logicalW = Math.ceil(item.frame.w) + margin * 2
    const logicalH = Math.ceil(item.frame.h) + margin * 2
    if (logicalW <= 0 || logicalH <= 0) return null

    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(logicalW * this.#ratio)),
      Math.max(1, Math.round(logicalH * this.#ratio)),
    )
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.setTransform(this.#ratio, 0, 0, this.#ratio, 0, 0)
    drawFramedImage(ctx, { x: margin, y: margin, w: item.frame.w, h: item.frame.h }, item.image, style)

    const tile: CachedTile = { canvas, dx: margin, dy: margin, w: logicalW, h: logicalH, key }
    this.#tiles.set(item.id, tile)
    return tile
  }

  invalidate(id: string): void {
    this.#tiles.delete(id)
  }

  /** Drops tiles for nodes that no longer exist, so removed images free memory. */
  retain(ids: Iterable<string>): void {
    const keep = new Set(ids)
    for (const id of [...this.#tiles.keys()]) {
      if (!keep.has(id)) this.#tiles.delete(id)
    }
  }

  clear(): void {
    this.#tiles.clear()
  }

  get size(): number {
    return this.#tiles.size
  }
}

/** Position is deliberately absent: moving a node must not rebuild its tile. */
function tileKey(item: RenderItem, style: StylePreset, ratio: number): string {
  return `${Math.round(item.frame.w)}x${Math.round(item.frame.h)}:${style}:${ratio.toFixed(2)}`
}
