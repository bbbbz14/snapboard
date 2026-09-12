import type { Rect } from '@/lib/geometry'
import type { Ctx2D } from './renderScene'

/**
 * Self-hosted (see CLAUDE.md invariant 6 and product plan 9.2 - fonts must
 * never come from a third-party CDN). Inter covers Latin; Anuphan - drawn to
 * pair with Inter, same modern grotesque feel - covers Thai. Both are
 * declared under this one family name in styles.css so a single `ctx.font`
 * gets both scripts without the caller needing to know which glyph came from
 * which file. Weight 600 only - no bold/regular toggle, same "no decision
 * nothing asked for yet" scope cut `DEFAULT_ANNOTATION_COLOR` already used
 * for arrow/box.
 */
export const TEXT_FONT_FAMILY = '"Snapboard Annotation", ui-sans-serif, system-ui, sans-serif'
const TEXT_FONT_WEIGHT = 600

/** Board-space px; scales with preview zoom/export scale via the caller's
 * canvas transform, same as `ARROW_STROKE_WIDTH`/`BOX_STROKE_WIDTH`. */
export const TEXT_FONT_SIZE = 22
export const TEXT_LINE_HEIGHT = Math.round(TEXT_FONT_SIZE * 1.35)
/** Breathing room inside the frame so glyphs don't touch its edges. */
export const TEXT_PADDING = 8
/** Fixed width for a freshly-placed text box - not user-resizable, same
 * scope cut arrow/box already made for their own geometry. Height instead
 * grows automatically with the wrapped line count, computed by `textHeight`. */
export const TEXT_DEFAULT_WIDTH = 240

export function textFont(): string {
  return `${TEXT_FONT_WEIGHT} ${TEXT_FONT_SIZE}px ${TEXT_FONT_FAMILY}`
}

const wordSegmenter = typeof Intl !== 'undefined' ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null
const graphemeSegmenter = typeof Intl !== 'undefined' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null

/**
 * Greedy line wrap driven by `Intl.Segmenter` word boundaries rather than
 * splitting on spaces - Thai has no spaces between words, so a space-only
 * wrapper would never break a long Thai sentence and it would just run off
 * the box. `measure` is injected rather than a `Ctx2D` so this stays a pure
 * function, testable in Node (see tests/unit/text.test.ts) - `drawText`
 * below is what actually wires it to a real canvas context.
 */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) lines.push(...wrapParagraph(measure, paragraph, maxWidth))
  return lines
}

function wrapParagraph(measure: (s: string) => number, paragraph: string, maxWidth: number): string[] {
  if (paragraph === '') return ['']
  const segments = wordSegmenter
    ? [...wordSegmenter.segment(paragraph)].map((s) => s.segment)
    : paragraph.split(/(\s+)/).filter((s) => s !== '')

  const lines: string[] = []
  // Trims the trailing space a completed line can inherit from the
  // whitespace segment that used to separate it from the next word -
  // otherwise every wrapped-on-a-space line would end with an invisible
  // (but measurable) trailing space.
  const pushLine = (s: string) => lines.push(s.replace(/\s+$/, ''))
  let current = ''
  for (const segment of segments) {
    const candidate = current + segment
    if (current !== '' && measure(candidate) > maxWidth) {
      if (segment.trim() !== '' && measure(segment) > maxWidth) {
        // The token alone is wider than the box (a long word or URL) - break
        // it at grapheme boundaries so a Thai vowel/tone mark never gets
        // split from the consonant it's combined with.
        pushLine(current)
        const pieces = breakToWidth(measure, segment, maxWidth)
        lines.push(...pieces.slice(0, -1))
        current = pieces[pieces.length - 1] ?? ''
      } else if (segment.trim() === '') {
        // The break is a run of whitespace - drop it rather than starting
        // the next line with a leading space.
        pushLine(current)
        current = ''
      } else {
        pushLine(current)
        current = segment
      }
    } else {
      current = candidate
    }
  }
  pushLine(current)
  return lines
}

function breakToWidth(measure: (s: string) => number, token: string, maxWidth: number): string[] {
  const units = graphemeSegmenter ? [...graphemeSegmenter.segment(token)].map((s) => s.segment) : [...token]
  const pieces: string[] = []
  let current = ''
  for (const unit of units) {
    const candidate = current + unit
    if (current !== '' && measure(candidate) > maxWidth) {
      pieces.push(current)
      current = unit
    } else {
      current = candidate
    }
  }
  pieces.push(current)
  return pieces
}

/** Frame height for a text box with this many wrapped lines - at least one
 * line's worth, even for empty text, so a freshly-placed box isn't zero-height. */
export function textHeight(lineCount: number): number {
  return Math.max(1, lineCount) * TEXT_LINE_HEIGHT + TEXT_PADDING * 2
}

/** Same drawing used identically by `renderScene` (committed text, board-
 * space) - there is no interaction-canvas preview call like `strokeArrow`/
 * `strokeBox` get, because the node being actively edited is hidden from the
 * canvas entirely in favour of the textarea overlay (see BoardCanvas) - it
 * never needs a screen-space draw of its own. Still factored out, alongside
 * `wrapText`, so a future caller can't drift from how lines actually wrap. */
export function drawText(ctx: Ctx2D, frame: Rect, text: string, color: string): void {
  ctx.save()
  ctx.font = textFont()
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const maxWidth = Math.max(1, frame.w - TEXT_PADDING * 2)
  const lines = wrapText((s) => ctx.measureText(s).width, text, maxWidth)
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, frame.x + TEXT_PADDING, frame.y + TEXT_PADDING + i * TEXT_LINE_HEIGHT)
  }
  ctx.restore()
}

let fontLoad: Promise<void> | null = null

/**
 * Loads the self-hosted annotation font before it's first drawn. Unlike DOM
 * text, canvas `fillText` has no `font-display` equivalent - a frame drawn
 * before the face finishes loading silently falls back to a system font
 * *forever*, with no automatic repaint once the real face becomes ready.
 * Callers must await this (or react to it resolving) and force one redraw -
 * see BoardCanvas's `fontReady` state, needed for a board restored from
 * autosave that may already contain text nodes.
 */
export function ensureAnnotationFont(): Promise<void> {
  if (!fontLoad) {
    fontLoad =
      typeof document === 'undefined' || !('fonts' in document)
        ? Promise.resolve()
        : Promise.all([document.fonts.load(textFont(), 'Ag'), document.fonts.load(textFont(), 'ก')])
            .then(() => undefined)
            .catch(() => undefined)
  }
  return fontLoad
}
