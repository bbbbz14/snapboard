/// <reference lib="webworker" />

/**
 * Decoding runs off the main thread: a 4K screenshot costs ~23ms on Chromium
 * and ~88ms on WebKit (Phase 0, S2), which would visibly stall dragging.
 */

export interface DecodeRequest {
  id: string
  blob: Blob
  maxDim: number
}

export interface DecodeResponse {
  id: string
  ok: boolean
  display?: ImageBitmap
  natural?: { w: number; h: number }
  error?: string
}

self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, blob, maxDim } = event.data
  try {
    const full = await createImageBitmap(blob)
    const natural = { w: full.width, h: full.height }
    const scale = Math.min(1, maxDim / Math.max(natural.w, natural.h))

    let display = full
    if (scale < 1) {
      display = await createImageBitmap(full, {
        resizeWidth: Math.max(1, Math.round(natural.w * scale)),
        resizeHeight: Math.max(1, Math.round(natural.h * scale)),
        resizeQuality: 'high',
      })
      full.close()
    }

    const response: DecodeResponse = { id, ok: true, display, natural }
    ;(self as unknown as Worker).postMessage(response, [display])
  } catch (e) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: String(e) } satisfies DecodeResponse)
  }
}
