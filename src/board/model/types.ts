import type { Point, Rect, Size } from '@/lib/geometry'

export type NodeId = string
export type AssetId = string

/**
 * `auto` picks one of the concrete modes from the images themselves.
 * `free` means the user has taken manual control and auto-layout must not
 * overwrite their arrangement.
 */
export type LayoutMode = 'auto' | 'rows' | 'columns' | 'grid' | 'compare' | 'steps' | 'free'

export type ResolvedLayoutMode = Exclude<LayoutMode, 'auto' | 'free'>

export type Background =
  | { type: 'solid'; color: string }
  | { type: 'transparent' }
  | { type: 'gradient'; from: string; to: string }

/** How images are framed. Only the shadow is expensive to draw — see ADR-002. */
export type StylePreset = 'plain' | 'card' | 'soft'

export interface ImageNode {
  kind: 'image'
  id: NodeId
  assetId: AssetId
  /** Layout writes this; in `free` mode the user owns it. */
  frame: Rect
  /** Logical order, drives layout position and step numbering. */
  order: number
  /** Normalized (0..1) sub-rect of the source image actually drawn - the
   * product plan's own `ImageNode.crop`, for trimming the excess a
   * screenshot often has. Absent means "the whole image, uncropped", which
   * is why most nodes never carry this field at all. Committing a crop also
   * sets `frame` to match (see `commitCrop`/`crop.ts`), so `frame`'s aspect
   * ratio and `crop`'s never disagree - the source rect drawn by
   * `drawFramedImage` always fills `frame` exactly, never stretched. */
  crop?: Rect
}

/** A connector, per the product plan's Phase 4 annotations - gently curved by
 * default, or a plain straight line (real-usage feedback: a curve "looks
 * unprofessional" for some uses, e.g. pointing at UI precisely) if `straight`
 * is true. `frame` is a derived, padded bounding box - kept only so the
 * generic hitTest/marquee/zorder code (which knows nothing about node kinds)
 * works for arrows exactly like it does for images; `start`/`end` are the
 * source of truth for where it's actually drawn. Optional and absent means
 * curved - older boards saved before this field existed must keep rendering
 * exactly as they did (see `toRenderInput`'s `?? false`), even though a
 * brand-new arrow's tool default is now straight (see boardStore's
 * `DEFAULT_TOOL_SETTINGS`). */
export interface ArrowNode {
  kind: 'arrow'
  id: NodeId
  frame: Rect
  order: number
  start: Point
  end: Point
  color: string
  /** Board-space stroke width, chosen at creation from the arrow tool's
   * current setting - see `ANNOTATION_SIZE_RANGE.arrow`. */
  size: number
  straight?: boolean
}

/** A plain straight line with no arrowhead - for underlining text or
 * connecting two points without implying direction, unlike `ArrowNode` (which
 * always has a head, whether curved or straight). Mirrors `ArrowNode`'s shape
 * for the same reason: `frame` is a derived, padded bounding box so the
 * generic hitTest/marquee/zorder code needs no per-kind branch, `start`/`end`
 * are the source of truth for where it's actually drawn. */
export interface LineNode {
  kind: 'line'
  id: NodeId
  frame: Rect
  order: number
  start: Point
  end: Point
  color: string
  /** Board-space stroke width, chosen at creation from the line tool's
   * current setting - see `ANNOTATION_SIZE_RANGE.line`. */
  size: number
}

/** A rectangular outline to frame a region of interest (product plan's
 * "กล่องกรอบ"). Unlike `ArrowNode`, `frame` here is not a derived padding -
 * it *is* the rectangle the user dragged, exactly like `ImageNode.frame`, so
 * it needs no separate start/end and every generic frame-based helper
 * (move, duplicate, hitTest) already does the right thing with no per-kind
 * branch. */
export interface BoxNode {
  kind: 'box'
  id: NodeId
  frame: Rect
  order: number
  color: string
  /** Board-space stroke width, chosen at creation from the box tool's
   * current setting - see `ANNOTATION_SIZE_RANGE.box`. */
  size: number
}

/** A short text label - "ข้อความ" in the product plan's Phase 4 feature
 * list. Like `BoxNode`, `frame` is not derived: `x`/`y` are where the user
 * clicked to place it, so every generic frame-based helper (move, duplicate,
 * hitTest) already does the right thing with no per-kind branch. Unlike
 * `BoxNode`, neither `w` nor `h` is fixed at creation - both track the
 * content, growing (and shrinking) with it: `w` fits the widest unwrapped
 * line up to a cap, `h` fits the resulting wrapped line count (via
 * `textAutoWidth`/`textHeight` in render/text.ts), recomputed every time
 * `text` changes, not just once at creation. */
export interface TextNode {
  kind: 'text'
  id: NodeId
  frame: Rect
  order: number
  text: string
  color: string
  /** Board-space font size, chosen at creation from the text tool's current
   * setting - see `ANNOTATION_SIZE_RANGE.text`. Fixed for the life of the
   * node, same as `frame.w` - a re-edit can change `text`, not this. */
  size: number
}

/** A standalone numbered marker - "ตัวเลขกำกับอัตโนมัติ" in the product plan's
 * Phase 4 list. Deliberately named `MarkerNode`/`'marker'`, not "badge",
 * to avoid confusion with the unrelated per-image step-sequence badge the
 * `'steps'` auto-layout already draws (`RenderItem.badge`/`drawBadge` in
 * renderScene.ts) - that one numbers images by layout position; this one is
 * a node the user places by hand, numbered by placement order among markers
 * only (see `toRenderInput`). Like `BoxNode`, `frame` is not derived - it's
 * a fixed-size square centered on the click that placed it - so every
 * generic frame-based helper (move, duplicate, hitTest) needs no per-kind
 * branch, same reasoning box/text already established. */
export interface MarkerNode {
  kind: 'marker'
  id: NodeId
  frame: Rect
  order: number
  color: string
}

/** A solid-fill rectangle that permanently covers sensitive content -
 * "เซ็นเซอร์" (redact) in the product plan's Phase 4 list. Deliberately
 * solid-fill only, no blur/pixelate mode: the product plan's own risk note
 * warns a light blur can be reversed, so this ships only the one mode
 * that's irrecoverable by construction - the covered pixels are simply
 * never drawn. Like `BoxNode`, `frame` is not derived - it's the rectangle
 * the user dragged, so every generic frame-based helper (move, duplicate,
 * hitTest) needs no per-kind branch. `color` was deliberately absent through
 * Phase 4 item 5 to foreclose a see-through redaction; it's added back here
 * because a solid, fully-opaque fill in a chosen color carries none of that
 * risk - there is still no opacity dial, so the fill can never be anything
 * but 100% covering. No `size` field, unlike arrow/box/marker/text - a
 * redaction has no separate stroke/diameter/font dimension, its size is
 * already the dragged rectangle. */
export interface RedactNode {
  kind: 'redact'
  id: NodeId
  frame: Rect
  order: number
  color: string
}

export type BoardNode = ImageNode | ArrowNode | LineNode | BoxNode | TextNode | MarkerNode | RedactNode

export interface Board {
  version: 1
  layout: LayoutMode
  /** Mode actually used to place nodes; equals `layout` unless it was `auto`. */
  resolvedLayout: ResolvedLayoutMode
  gap: number
  padding: number
  /** Explicit grid column count, or null to let the layout decide. */
  columns: number | null
  targetWidth: number
  background: Background
  style: StylePreset
  nodes: BoardNode[]
  size: Size
}

export const STYLE_PRESETS: Record<StylePreset, { radius: number; shadow: null | { blur: number; offsetY: number; color: string } }> = {
  plain: { radius: 0, shadow: null },
  card: { radius: 8, shadow: { blur: 16, offsetY: 4, color: 'rgba(15, 23, 42, 0.16)' } },
  soft: { radius: 14, shadow: { blur: 34, offsetY: 12, color: 'rgba(15, 23, 42, 0.22)' } },
}

export const BACKGROUNDS = {
  white: { type: 'solid', color: '#ffffff' },
  black: { type: 'solid', color: '#0b0f14' },
  transparent: { type: 'transparent' },
  // Six fixed presets, not a custom color picker - same "no decision nothing
  // asked for yet" scope cut every annotation tool's color choice already
  // used before this revision reopened it. Board content, so these never
  // follow the OS theme (same reasoning as --annotation/--checker*).
  gradientSunrise: { type: 'gradient', from: '#ff5f6d', to: '#ffc371' },
  gradientOcean: { type: 'gradient', from: '#2193b0', to: '#6dd5ed' },
  gradientMint: { type: 'gradient', from: '#43e97b', to: '#38f9d7' },
  gradientBerry: { type: 'gradient', from: '#fc466b', to: '#3f5efb' },
  gradientDusk: { type: 'gradient', from: '#667eea', to: '#764ba2' },
  gradientMidnight: { type: 'gradient', from: '#232526', to: '#414345' },
} as const satisfies Record<string, Background>

export type BackgroundName = keyof typeof BACKGROUNDS

export const DEFAULT_BOARD: Board = {
  version: 1,
  layout: 'auto',
  resolvedLayout: 'rows',
  gap: 6,
  padding: 32,
  columns: null,
  targetWidth: 1200,
  background: BACKGROUNDS.white,
  style: 'card',
  nodes: [],
  size: { w: 1200, h: 700 },
}
