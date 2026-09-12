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
}

/** A gently curved connector, per the product plan's Phase 4 annotations.
 * `frame` is a derived, padded bounding box - kept only so the generic
 * hitTest/marquee/zorder code (which knows nothing about node kinds) works
 * for arrows exactly like it does for images; `start`/`end` are the source
 * of truth for where it's actually drawn. */
export interface ArrowNode {
  kind: 'arrow'
  id: NodeId
  frame: Rect
  order: number
  start: Point
  end: Point
  color: string
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
}

/** A short text label - "ข้อความ" in the product plan's Phase 4 feature
 * list. Like `BoxNode`, `frame` is not derived: `x`/`y` are where the user
 * clicked to place it and `w` is fixed at creation, so every generic
 * frame-based helper (move, duplicate, hitTest) already does the right
 * thing with no per-kind branch. `h` is the one field that isn't fixed - it
 * tracks the wrapped line count and is recomputed (via `textHeight` in
 * render/text.ts) every time `text` changes, not just once at creation. */
export interface TextNode {
  kind: 'text'
  id: NodeId
  frame: Rect
  order: number
  text: string
  color: string
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

export type BoardNode = ImageNode | ArrowNode | BoxNode | TextNode | MarkerNode

/** Shared by every annotation kind - red, visible on any background, per
 * the product plan's "สีอัตโนมัติ (แดงเป็นค่าเริ่มต้น)". */
export const DEFAULT_ANNOTATION_COLOR = '#dc2626'

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
  slate: { type: 'solid', color: '#eef2f7' },
  transparent: { type: 'transparent' },
} as const satisfies Record<string, Background>

export type BackgroundName = keyof typeof BACKGROUNDS

export const DEFAULT_BOARD: Board = {
  version: 1,
  layout: 'auto',
  resolvedLayout: 'rows',
  gap: 20,
  padding: 32,
  columns: null,
  targetWidth: 1200,
  background: BACKGROUNDS.white,
  style: 'card',
  nodes: [],
  size: { w: 1200, h: 700 },
}
