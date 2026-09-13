/**
 * Shared across every annotation kind - red is first so `DEFAULT_ANNOTATION_COLOR`
 * (the product plan's "สีอัตโนมัติ (แดงเป็นค่าเริ่มต้น)") stays what a brand-new
 * board's tools start with. The other six are the user's explicit picks for
 * this revision, chosen for contrast against the light backgrounds/real
 * screenshots this app actually gets used on - black over white, per that
 * same reasoning.
 */
export const ANNOTATION_COLORS = ['#dc2626', '#f97316', '#eab308', '#16a34a', '#0ea5e9', '#9333ea', '#111827'] as const
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number]
export const DEFAULT_ANNOTATION_COLOR: AnnotationColor = ANNOTATION_COLORS[0]

export type Tool = 'select' | 'arrow' | 'box' | 'text' | 'marker' | 'redact'
export type AnnotationTool = Exclude<Tool, 'select'>
/** Every annotation kind except redact - a redaction's size is already the
 * dragged rectangle, so it has no separate stroke/diameter/font dimension to
 * adjust (see `RedactNode`'s own note on why a size control there would
 * reopen the see-through-redaction risk item 5 was scoped to avoid). */
export type SizableAnnotationTool = Exclude<AnnotationTool, 'redact'>

/**
 * Board-space min/max/default for the one size dimension each tool has -
 * arrow/box's stroke width, marker's diameter, text's font size. The
 * `default` values are what every one of these tools shipped with before
 * this revision (`ARROW_STROKE_WIDTH`, `BOX_STROKE_WIDTH`, `MARKER_DIAMETER`,
 * `TEXT_FONT_SIZE`), kept unchanged so existing boards render identically.
 */
export const ANNOTATION_SIZE_RANGE: Record<SizableAnnotationTool, { min: number; max: number; default: number }> = {
  arrow: { min: 2, max: 12, default: 4 },
  box: { min: 2, max: 12, default: 3 },
  marker: { min: 24, max: 64, default: 36 },
  text: { min: 14, max: 40, default: 22 },
}

export function clampAnnotationSize(tool: SizableAnnotationTool, size: number): number {
  const { min, max } = ANNOTATION_SIZE_RANGE[tool]
  return Math.min(max, Math.max(min, Math.round(size)))
}
