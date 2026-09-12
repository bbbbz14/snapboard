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

export type BoardNode = ImageNode | ArrowNode

export const DEFAULT_ARROW_COLOR = '#dc2626'

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
