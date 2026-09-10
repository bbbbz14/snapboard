/** SPIKE harness. Exposes measurable operations on window for Playwright to drive. */
import { renderScene, hitTest, type Scene, type SceneNode } from './proto/render'

const log = (m: unknown) => {
  document.getElementById('log')!.textContent += JSON.stringify(m) + '\n'
}

/* ---------- shared fixtures ---------- */

async function makeTestBlob(w: number, h: number, seed = 0): Promise<Blob> {
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, `hsl(${(seed * 37) % 360} 80% 55%)`)
  g.addColorStop(1, `hsl(${(seed * 37 + 120) % 360} 80% 35%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // Some structure so PNG doesn't compress to nothing (realistic screenshot-ish).
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 400; i++) {
    ctx.fillRect((i * 137) % w, (i * 271) % h, 60, 14)
  }
  return c.convertToBlob({ type: 'image/png' })
}

/* ---------- S2: decode throughput + memory ---------- */

async function s2Decode(count: number, w: number, h: number) {
  const blobs: Blob[] = []
  for (let i = 0; i < count; i++) blobs.push(await makeTestBlob(w, h, i))
  const totalBytes = blobs.reduce((a, b) => a + b.size, 0)

  const t0 = performance.now()
  const bitmaps = await Promise.all(blobs.map((b) => createImageBitmap(b)))
  const decodeMs = performance.now() - t0

  const t1 = performance.now()
  const displays = await Promise.all(
    bitmaps.map((bm) => {
      const s = Math.min(1, 2048 / Math.max(bm.width, bm.height))
      return createImageBitmap(bm, { resizeWidth: Math.round(bm.width * s), resizeHeight: Math.round(bm.height * s) })
    }),
  )
  const downscaleMs = performance.now() - t1

  const fullPx = bitmaps.reduce((a, b) => a + b.width * b.height, 0)
  const dispPx = displays.reduce((a, b) => a + b.width * b.height, 0)
  bitmaps.forEach((b) => b.close())
  displays.forEach((b) => b.close())

  return {
    count,
    source: `${w}x${h}`,
    encodedMB: +(totalBytes / 1e6).toFixed(1),
    decodeMs: Math.round(decodeMs),
    downscaleMs: Math.round(downscaleMs),
    msPerImage: +(decodeMs / count).toFixed(1),
    fullResVRAM_MB: +((fullPx * 4) / 1e6).toFixed(0),
    displayVRAM_MB: +((dispPx * 4) / 1e6).toFixed(0),
  }
}

/* ---------- S3: canvas size limits ---------- */

function canvasWorks(w: number, h: number): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return false
    ctx.fillStyle = '#f00'
    ctx.fillRect(w - 2, h - 2, 2, 2)
    const d = ctx.getImageData(w - 1, h - 1, 1, 1).data
    c.width = c.height = 0 // release
    return d[0] === 255 && d[3] === 255
  } catch {
    return false
  }
}

function s3Limits() {
  const search = (probe: (n: number) => boolean, hi: number) => {
    let lo = 1
    if (probe(hi)) return hi
    while (lo < hi - 64) {
      const mid = Math.floor((lo + hi) / 2)
      if (probe(mid)) lo = mid
      else hi = mid
    }
    return lo
  }
  const maxSquare = search((n) => canvasWorks(n, n), 32768)
  const maxHeightAt4000 = search((n) => canvasWorks(4000, n), 65536)
  const maxDimension = search((n) => canvasWorks(n, 16), 131072)
  return {
    maxSquare,
    maxSquareAreaMP: +((maxSquare * maxSquare) / 1e6).toFixed(0),
    maxHeightAt4000,
    maxDimension,
  }
}

/* ---------- S4: single-renderer parity + frame cost ---------- */

async function s4Render(imageCount: number) {
  const bitmaps = await Promise.all(
    Array.from({ length: imageCount }, (_, i) => makeTestBlob(1400, 900, i).then((b) => createImageBitmap(b))),
  )
  const cols = 3
  const cellW = 380
  const cellH = 250
  const gap = 24
  const pad = 40
  const nodes: SceneNode[] = bitmaps.map((bm, i) => ({
    kind: 'image' as const,
    id: `img${i}`,
    frame: {
      x: pad + (i % cols) * (cellW + gap),
      y: pad + Math.floor(i / cols) * (cellH + gap),
      w: cellW,
      h: cellH,
    },
    radius: 10,
    shadow: true,
    bitmap: bm,
  }))
  nodes.push({
    kind: 'text',
    id: 't1',
    text: 'Step 1 — open the admin panel and locate the failing record in the list view',
    frame: { x: pad, y: pad - 28, w: cellW * 2, h: 40 },
    size: 16,
    color: '#0f172a',
  })
  nodes.push({ kind: 'arrow', id: 'a1', from: { x: 120, y: 300 }, to: { x: 320, y: 180 }, color: '#ef4444', width: 4 })
  nodes.push({ kind: 'redact', id: 'r1', frame: { x: 200, y: 120, w: 180, h: 40 }, cell: 10 })
  // Hard-edged calibration landmark: solid black, no shadow, integer coords.
  // A soft shadow edge would only measure the antialiaser, not our geometry.
  const LANDMARK_X = 100
  const LANDMARK_Y = 8
  nodes.push({
    kind: 'rect',
    id: 'calib',
    frame: { x: LANDMARK_X, y: LANDMARK_Y, w: 60, h: 16 },
    fill: '#000000',
    stroke: null,
    width: 0,
  })

  const rows = Math.ceil(imageCount / cols)
  const scene: Scene = {
    size: { w: pad * 2 + cols * cellW + (cols - 1) * gap, h: pad * 2 + rows * cellH + (rows - 1) * gap },
    background: '#ffffff',
    nodes,
  }

  // Preview render (scale 1) — measure steady-state frame cost.
  const preview = new OffscreenCanvas(scene.size.w, scene.size.h)
  const pctx = preview.getContext('2d')!
  renderScene(pctx, scene, { scale: 1 })
  const frames: number[] = []
  for (let i = 0; i < 30; i++) {
    const t = performance.now()
    renderScene(pctx, scene, { scale: 1 })
    frames.push(performance.now() - t)
  }
  frames.sort((a, b) => a - b)

  // Parity A — the one that actually matters for risk R1:
  // the export path (OffscreenCanvas -> PNG -> decode) at the same scale must
  // reproduce the preview exactly. Any drift here is a real architecture bug.
  const exp1 = new OffscreenCanvas(scene.size.w, scene.size.h)
  renderScene(exp1.getContext('2d')!, scene, { scale: 1 })
  const blob1 = await exp1.convertToBlob({ type: 'image/png' })
  const rt = new OffscreenCanvas(scene.size.w, scene.size.h)
  const rtctx = rt.getContext('2d')!
  const bm1 = await createImageBitmap(blob1)
  rtctx.drawImage(bm1, 0, 0)
  bm1.close()
  const parityA = diffStats(
    pctx.getImageData(0, 0, scene.size.w, scene.size.h).data,
    rtctx.getImageData(0, 0, scene.size.w, scene.size.h).data,
  )

  // Export render (scale 2) using the exact same function.
  const t0 = performance.now()
  const exp = new OffscreenCanvas(scene.size.w * 2, scene.size.h * 2)
  const ectx = exp.getContext('2d')!
  renderScene(ectx, scene, { scale: 2 })
  const blob = await exp.convertToBlob({ type: 'image/png' })
  const exportMs = performance.now() - t0

  // Parity B — geometry at 2x. Resampling makes a pixel diff meaningless here,
  // so instead assert that a known landmark lands at exactly twice the coordinate.
  const expBm = await createImageBitmap(blob)
  const big = new OffscreenCanvas(scene.size.w * 2, scene.size.h * 2)
  const bctx = big.getContext('2d')!
  bctx.drawImage(expBm, 0, 0)
  const edge1x = firstDarkX(pctx, LANDMARK_Y + 8, scene.size.w)
  const edge2x = firstDarkX(bctx, (LANDMARK_Y + 8) * 2, scene.size.w * 2)

  // Parity C — informational: 2x downscaled back to 1x (expected to differ on
  // antialiased edges; we track mean error, not pixel counts).
  const down = new OffscreenCanvas(scene.size.w, scene.size.h)
  const dctx = down.getContext('2d')!
  dctx.drawImage(expBm, 0, 0, scene.size.w, scene.size.h)
  const parityC = diffStats(
    pctx.getImageData(0, 0, scene.size.w, scene.size.h).data,
    dctx.getImageData(0, 0, scene.size.w, scene.size.h).data,
  )
  expBm.close()
  bitmaps.forEach((bm) => bm.close())

  return {
    imageCount,
    sceneSize: `${scene.size.w}x${scene.size.h}`,
    frameMedianMs: +frames[Math.floor(frames.length / 2)]!.toFixed(2),
    frameP95Ms: +frames[Math.floor(frames.length * 0.95)]!.toFixed(2),
    exportMs: Math.round(exportMs),
    exportMB: +(blob.size / 1e6).toFixed(2),
    parityA_exportRoundTrip: parityA,
    parityB_landmark: { edgeAt1x: edge1x, edgeAt2x: edge2x, exactlyDoubled: edge2x === edge1x * 2 },
    parityC_downscaled2x: parityC,
  }
}

/** Pixel comparison reported as both a threshold count and a mean error. */
function diffStats(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let over8 = 0
  let sum = 0
  let max = 0
  const n = a.length / 4
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!))
    if (d > 8) over8++
    sum += d
    if (d > max) max = d
  }
  return {
    pctPixelsOver8: +((over8 / n) * 100).toFixed(4),
    meanChannelError: +(sum / n).toFixed(3),
    maxChannelError: max,
  }
}

/** X of the first solid-dark pixel on a row — used to verify geometry scales exactly. */
function firstDarkX(ctx: OffscreenCanvasRenderingContext2D, y: number, width: number): number {
  const row = ctx.getImageData(0, y, width, 1).data
  for (let x = 0; x < width; x++) {
    if (row[x * 4]! < 40 && row[x * 4 + 1]! < 40 && row[x * 4 + 2]! < 40) return x
  }
  return -1
}

/* ---------- S4c: where does the frame time go? ---------- */

/**
 * Isolates the cost of the "premium look" (rounded corners + drop shadow) and
 * measures whether pre-compositing each image into a cached tile fixes it.
 * Decides the Phase 1 rendering strategy.
 */
async function s4FrameCost(imageCount: number) {
  const bitmaps = await Promise.all(
    Array.from({ length: imageCount }, (_, i) => makeTestBlob(1400, 900, i).then((b) => createImageBitmap(b))),
  )
  const cols = 3
  const cellW = 380
  const cellH = 250
  const gap = 24
  const pad = 40
  const frames = bitmaps.map((_, i) => ({
    x: pad + (i % cols) * (cellW + gap),
    y: pad + Math.floor(i / cols) * (cellH + gap),
    w: cellW,
    h: cellH,
  }))
  const rows = Math.ceil(imageCount / cols)
  const size = { w: pad * 2 + cols * cellW + (cols - 1) * gap, h: pad * 2 + rows * cellH + (rows - 1) * gap }

  const mkScene = (shadow: boolean, radius: number): Scene => ({
    size,
    background: '#ffffff',
    nodes: bitmaps.map((bm, i) => ({
      kind: 'image' as const,
      id: `i${i}`,
      frame: frames[i]!,
      radius,
      shadow,
      bitmap: bm,
    })),
  })

  const canvas = new OffscreenCanvas(size.w, size.h)
  const ctx = canvas.getContext('2d')!
  // Canvas commands rasterize asynchronously on some engines (WebKit reported
  // 0 ms without this). Reading one pixel forces the work to complete before
  // the clock is read.
  const flush = () => ctx.getImageData(size.w - 1, size.h - 1, 1, 1).data[3]
  const bench = (fn: () => void) => {
    for (let i = 0; i < 5; i++) {
      fn()
      flush()
    }
    const t: number[] = []
    for (let i = 0; i < 25; i++) {
      const s0 = performance.now()
      fn()
      flush()
      t.push(performance.now() - s0)
    }
    t.sort((a, b) => a - b)
    return +t[Math.floor(t.length / 2)]!.toFixed(2)
  }
  const flushOnlyMs = (() => {
    const t: number[] = []
    for (let i = 0; i < 25; i++) {
      const s0 = performance.now()
      flush()
      t.push(performance.now() - s0)
    }
    t.sort((a, b) => a - b)
    return +t[Math.floor(t.length / 2)]!.toFixed(2)
  })()

  const withShadow = bench(() => renderScene(ctx, mkScene(true, 10), { scale: 1 }))
  const noShadow = bench(() => renderScene(ctx, mkScene(false, 10), { scale: 1 }))
  const plain = bench(() => renderScene(ctx, mkScene(false, 0), { scale: 1 }))

  // Cached-tile strategy: each image node pre-rendered once (shadow + rounding
  // baked in), then the frame is just N drawImage calls.
  const tiles = frames.map((f, i) => {
    const m = 40
    const tile = new OffscreenCanvas(f.w + m * 2, f.h + m * 2)
    const tctx = tile.getContext('2d')!
    renderScene(
      tctx,
      {
        size: { w: f.w + m * 2, h: f.h + m * 2 },
        background: null,
        nodes: [
          { kind: 'image', id: 't', frame: { x: m, y: m, w: f.w, h: f.h }, radius: 10, shadow: true, bitmap: bitmaps[i]! },
        ],
      },
      { scale: 1 },
    )
    return { tile, x: f.x - m, y: f.y - m }
  })
  const cached = bench(() => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size.w, size.h)
    for (const t of tiles) ctx.drawImage(t.tile, t.x, t.y)
  })

  bitmaps.forEach((b) => b.close())
  return {
    imageCount,
    roundedPlusShadowMs: withShadow,
    roundedNoShadowMs: noShadow,
    plainRectMs: plain,
    cachedTilesMs: cached,
    flushOverheadMs: flushOnlyMs,
    shadowCostMs: +(withShadow - noShadow).toFixed(2),
    speedupFromCaching: cached > 0 ? +(withShadow / cached).toFixed(1) : null,
  }
}

/* ---------- S4b: hit-test cost ---------- */

function s4HitTest(nodeCount: number) {
  const nodes: SceneNode[] = Array.from({ length: nodeCount }, (_, i) => ({
    kind: 'image' as const,
    id: `n${i}`,
    frame: { x: (i % 10) * 120, y: Math.floor(i / 10) * 120, w: 110, h: 110 },
    radius: 8,
    shadow: false,
    bitmap: new OffscreenCanvas(1, 1),
  }))
  const scene: Scene = { size: { w: 1200, h: 1200 }, background: '#fff', nodes }
  const t = performance.now()
  let hits = 0
  for (let i = 0; i < 10000; i++) {
    const r = hitTest(scene, { x: (i * 13) % 1200, y: (i * 29) % 1200 }, 'n5')
    if (r.type !== 'canvas') hits++
  }
  return { nodeCount, hits, usPerHitTest: +(((performance.now() - t) * 1000) / 10000).toFixed(2) }
}

/* ---------- S1: clipboard write ---------- */

async function buildPngBlob(): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = 800
  c.height = 600
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#0ea5e9'
  ctx.fillRect(0, 0, 800, 600)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
}

type ClipResult = { ok: boolean; error?: string }

async function copyPromiseForm(): Promise<ClipResult> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': buildPngBlob() })])
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

async function copyAwaitedForm(): Promise<ClipResult> {
  try {
    const blob = await buildPngBlob() // user activation may expire here
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** Verify the bytes actually landed on the clipboard, not just that write() resolved. */
async function readBackImage(): Promise<{ ok: boolean; types?: string[]; bytes?: number; error?: string }> {
  try {
    const items = await navigator.clipboard.read()
    const types = items.flatMap((i) => i.types)
    const item = items.find((i) => i.types.includes('image/png'))
    if (!item) return { ok: false, types, error: 'no image/png on clipboard' }
    const blob = await item.getType('image/png')
    return { ok: blob.size > 0, types, bytes: blob.size }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

function clipboardCapabilities() {
  return {
    hasClipboardWrite: typeof navigator.clipboard?.write === 'function',
    hasClipboardItem: typeof globalThis.ClipboardItem !== 'undefined',
    supportsPng:
      typeof globalThis.ClipboardItem !== 'undefined' && typeof ClipboardItem.supports === 'function'
        ? ClipboardItem.supports('image/png')
        : 'unknown',
    isSecureContext: window.isSecureContext,
  }
}

/* ---------- S5: input parsing (paste + drop) ---------- */

type ExtractResult = { source: string; files: { name: string; type: string; size: number }[]; rejected: string[] }

function extractImages(dt: DataTransfer | null, source: string): ExtractResult {
  const files: ExtractResult['files'] = []
  const rejected: string[] = []
  if (!dt) return { source, files, rejected }
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue
    const f = item.getAsFile()
    if (!f) continue
    if (f.type.startsWith('image/') && f.type !== 'image/svg+xml') {
      files.push({ name: f.name, type: f.type, size: f.size })
    } else {
      rejected.push(f.name || f.type)
    }
  }
  return { source, files, rejected }
}

const inputEvents: ExtractResult[] = []
window.addEventListener('paste', (e) => {
  const r = extractImages((e as ClipboardEvent).clipboardData, 'paste')
  inputEvents.push(r)
  log(r)
})
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => {
  e.preventDefault()
  const r = extractImages((e as DragEvent).dataTransfer, 'drop')
  inputEvents.push(r)
  log(r)
})

/* ---------- wiring ---------- */

document.getElementById('copy-good')!.addEventListener('click', async () => {
  ;(window as any).__lastClipboard = await copyPromiseForm()
})
document.getElementById('copy-bad')!.addEventListener('click', async () => {
  ;(window as any).__lastClipboard = await copyAwaitedForm()
})
;(window as any).__resetClipboardProbe = () => {
  delete (window as any).__lastClipboard
}

Object.assign(window as any, {
  spike: { s2Decode, s3Limits, s4Render, s4HitTest, s4FrameCost, clipboardCapabilities, readBackImage, inputEvents: () => inputEvents, clearInputEvents: () => (inputEvents.length = 0) },
})
log({ ready: true, ua: navigator.userAgent })
