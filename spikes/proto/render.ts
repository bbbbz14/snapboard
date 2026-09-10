/**
 * SPIKE S4 — prototype of the single-renderer architecture.
 *
 * Goal: prove that one `renderScene()` can drive both the on-screen preview and
 * the export, so "export doesn't match what I saw" (risk R1) is impossible by
 * construction. Also sizes the effort of hand-rolling hit-testing vs adopting
 * Konva/Fabric.
 *
 * Throwaway code. Not the Phase 1 implementation.
 */

export type Rect = { x: number; y: number; w: number; h: number }

export type SceneNode =
  | { kind: 'image'; id: string; frame: Rect; bitmap: CanvasImageSource; radius: number; shadow: boolean }
  | { kind: 'text'; id: string; frame: Rect; text: string; size: number; color: string }
  | { kind: 'arrow'; id: string; from: { x: number; y: number }; to: { x: number; y: number }; color: string; width: number }
  | { kind: 'rect'; id: string; frame: Rect; stroke: string | null; fill: string | null; width: number }
  | { kind: 'redact'; id: string; frame: Rect; cell: number }

export type Scene = {
  size: { w: number; h: number }
  background: string | null
  nodes: SceneNode[]
}

export type RenderOpts = {
  /** 1 for preview at 100%, 2/3 for hi-DPI export. The only difference between preview and export. */
  scale: number
}

/* ------------------------------------------------------------------ *
 * Text layout — shared by preview and export so wrapping can't drift.
 * measureText on a canvas context is the single source of truth.
 * ------------------------------------------------------------------ */

const measureCanvas = /* @__PURE__ */ (() =>
  typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : null)()

export function layoutText(text: string, maxWidth: number, font: string): string[] {
  const ctx = measureCanvas?.getContext('2d')
  if (!ctx) return [text]
  ctx.font = font
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }
  return lines
}

/* ------------------------------------------------------------------ *
 * Renderer
 * ------------------------------------------------------------------ */

export function renderScene(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  scene: Scene,
  { scale }: RenderOpts,
): void {
  ctx.save()
  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  if (scene.background) {
    ctx.fillStyle = scene.background
    ctx.fillRect(0, 0, scene.size.w, scene.size.h)
  } else {
    ctx.clearRect(0, 0, scene.size.w, scene.size.h)
  }

  for (const node of scene.nodes) {
    switch (node.kind) {
      case 'image':
        drawImageNode(ctx, node)
        break
      case 'text':
        drawTextNode(ctx, node)
        break
      case 'arrow':
        drawArrowNode(ctx, node)
        break
      case 'rect':
        drawRectNode(ctx, node)
        break
      case 'redact':
        drawRedactNode(ctx, node, scale)
        break
    }
  }

  ctx.restore()
}

function roundedPath(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, r: Rect, radius: number) {
  const k = Math.min(radius, r.w / 2, r.h / 2)
  ctx.beginPath()
  ctx.moveTo(r.x + k, r.y)
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k)
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k)
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k)
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k)
  ctx.closePath()
}

function drawImageNode(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  node: Extract<SceneNode, { kind: 'image' }>,
) {
  const { frame, radius, shadow, bitmap } = node
  ctx.save()
  if (shadow) {
    // Shadow is painted by filling the rounded silhouette, then cleared by the
    // clip below — avoids the shadow bleeding through semi-transparent PNGs.
    ctx.shadowColor = 'rgba(15, 23, 42, 0.18)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
    ctx.fillStyle = '#fff'
    roundedPath(ctx, frame, radius)
    ctx.fill()
    ctx.shadowColor = 'transparent'
  }
  roundedPath(ctx, frame, radius)
  ctx.clip()
  ctx.drawImage(bitmap, frame.x, frame.y, frame.w, frame.h)
  ctx.restore()
}

function drawTextNode(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  node: Extract<SceneNode, { kind: 'text' }>,
) {
  const font = `${node.size}px ui-sans-serif, system-ui, sans-serif`
  ctx.save()
  ctx.font = font
  ctx.fillStyle = node.color
  ctx.textBaseline = 'top'
  const lineHeight = node.size * 1.35
  const lines = layoutText(node.text, node.frame.w, font)
  lines.forEach((line, i) => ctx.fillText(line, node.frame.x, node.frame.y + i * lineHeight))
  ctx.restore()
}

function drawArrowNode(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  node: Extract<SceneNode, { kind: 'arrow' }>,
) {
  const { from, to, color, width } = node
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const head = width * 4
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x - Math.cos(angle) * head * 0.8, to.y - Math.sin(angle) * head * 0.8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - Math.cos(angle - 0.4) * head, to.y - Math.sin(angle - 0.4) * head)
  ctx.lineTo(to.x - Math.cos(angle + 0.4) * head, to.y - Math.sin(angle + 0.4) * head)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawRectNode(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  node: Extract<SceneNode, { kind: 'rect' }>,
) {
  ctx.save()
  if (node.fill) {
    ctx.fillStyle = node.fill
    ctx.fillRect(node.frame.x, node.frame.y, node.frame.w, node.frame.h)
  }
  if (node.stroke) {
    ctx.strokeStyle = node.stroke
    ctx.lineWidth = node.width
    ctx.strokeRect(node.frame.x, node.frame.y, node.frame.w, node.frame.h)
  }
  ctx.restore()
}

/**
 * Pixelate by downsampling the already-painted region and scaling it back up.
 * Critically this destroys the source pixels in the output buffer, so the
 * redaction survives export (risk R10) rather than being an overlay.
 */
function drawRedactNode(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  node: Extract<SceneNode, { kind: 'redact' }>,
  scale: number,
) {
  const { frame, cell } = node
  const dev = { x: frame.x * scale, y: frame.y * scale, w: frame.w * scale, h: frame.h * scale }
  const cols = Math.max(1, Math.round(frame.w / cell))
  const rows = Math.max(1, Math.round(frame.h / cell))
  const tmp = new OffscreenCanvas(cols, rows)
  const tctx = tmp.getContext('2d')!
  tctx.imageSmoothingEnabled = true
  tctx.drawImage(ctx.canvas as unknown as CanvasImageSource, dev.x, dev.y, dev.w, dev.h, 0, 0, cols, rows)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, frame.x, frame.y, frame.w, frame.h)
  ctx.restore()
}

/* ------------------------------------------------------------------ *
 * Hit testing — the thing Konva would give us for free.
 * Axis-aligned only (no rotation in the product), so it stays trivial.
 * ------------------------------------------------------------------ */

const HANDLE = 10

export type Hit =
  | { type: 'node'; id: string }
  | { type: 'handle'; id: string; corner: 'nw' | 'ne' | 'se' | 'sw' }
  | { type: 'canvas' }

export function hitTest(scene: Scene, p: { x: number; y: number }, selectedId?: string): Hit {
  if (selectedId) {
    const sel = scene.nodes.find((n) => n.id === selectedId)
    const frame = sel && 'frame' in sel ? sel.frame : null
    if (frame) {
      const corners = {
        nw: { x: frame.x, y: frame.y },
        ne: { x: frame.x + frame.w, y: frame.y },
        se: { x: frame.x + frame.w, y: frame.y + frame.h },
        sw: { x: frame.x, y: frame.y + frame.h },
      } as const
      for (const [corner, c] of Object.entries(corners)) {
        if (Math.abs(p.x - c.x) <= HANDLE && Math.abs(p.y - c.y) <= HANDLE) {
          return { type: 'handle', id: selectedId, corner: corner as 'nw' }
        }
      }
    }
  }
  for (let i = scene.nodes.length - 1; i >= 0; i--) {
    const n = scene.nodes[i]!
    if (n.kind === 'arrow') {
      if (distanceToSegment(p, n.from, n.to) <= Math.max(8, n.width * 2)) return { type: 'node', id: n.id }
      continue
    }
    const f = n.frame
    if (p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h) return { type: 'node', id: n.id }
  }
  return { type: 'canvas' }
}

function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
