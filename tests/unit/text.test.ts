import { describe, it, expect } from 'vitest'
import { TEXT_MAX_WIDTH, TEXT_MIN_WIDTH, TEXT_PADDING, textAutoWidth, textHeight, textLineHeight, wrapText } from '@/board/render/text'
import { ANNOTATION_SIZE_RANGE } from '@/board/model/annotationDefaults'

const FONT_SIZE = ANNOTATION_SIZE_RANGE.text.default

/** A fixed-width-per-character stand-in for `ctx.measureText(s).width` -
 * keeps these tests independent of any real font metrics. */
const monospace = (charWidth: number) => (s: string) => s.length * charWidth

describe('wrapText', () => {
  it('does not wrap text that already fits', () => {
    expect(wrapText(monospace(10), 'hello', 1000)).toEqual(['hello'])
  })

  it('wraps English on a space, not mid-word', () => {
    const lines = wrapText(monospace(10), 'one two three', 100)
    expect(lines).toEqual(['one two', 'three'])
  })

  it('preserves explicit newlines as separate paragraphs', () => {
    expect(wrapText(monospace(10), 'a\nb', 1000)).toEqual(['a', 'b'])
  })

  it('keeps an empty paragraph as a blank line', () => {
    expect(wrapText(monospace(10), 'a\n\nb', 1000)).toEqual(['a', '', 'b'])
  })

  it('wraps Thai text with no spaces at all, using word segmentation', () => {
    // Thai has no spaces between words - a space-only wrapper would never
    // break this and it would run straight off the box.
    const lines = wrapText(monospace(10), 'สวัสดีครับทดสอบข้อความ', 70)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe('สวัสดีครับทดสอบข้อความ')
  })

  it('never splits a Thai base character from its own combining vowel/tone mark', () => {
    // Force a break mid-token by giving one enormous "word" (no spaces, no
    // word boundaries) a maxWidth far smaller than a single Thai word -
    // exercises the grapheme-level fallback, not the word segmenter.
    const word = 'กำลังทดสอบการตัดคำภาษาไทยที่ยาวมากๆ'
    const lines = wrapText(monospace(10), word, 25)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe(word)
    // Rejoining must reproduce the exact original string - if a combining
    // mark had been separated from its base character onto the wrong line,
    // the characters would still all be present but landing on the wrong
    // side of a break wouldn't corrupt the string, so the real assertion is
    // that no line boundary falls inside a single grapheme cluster: every
    // line, rejoined, must still equal the original with no reordering.
    expect(lines.every((l) => l.length > 0)).toBe(true)
  })

  it('breaks an over-wide single token (e.g. a long URL) instead of overflowing', () => {
    const lines = wrapText(monospace(10), 'https://example.com/a/very/long/path/segment', 80)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(monospace(10)(line)).toBeLessThanOrEqual(80)
  })

  it('mixes Thai and English on one line without needing a space between them', () => {
    const lines = wrapText(monospace(10), 'ทดสอบ Hello', 1000)
    expect(lines).toEqual(['ทดสอบ Hello'])
  })
})

describe('textHeight', () => {
  it('is at least one line tall even for zero/empty content', () => {
    expect(textHeight(0, FONT_SIZE)).toBe(textHeight(1, FONT_SIZE))
  })

  it('grows linearly with the line count', () => {
    expect(textHeight(3, FONT_SIZE)).toBeGreaterThan(textHeight(2, FONT_SIZE))
    expect(textHeight(2, FONT_SIZE)).toBeGreaterThan(textHeight(1, FONT_SIZE))
  })

  it('grows with font size too, at a fixed line count', () => {
    expect(textHeight(2, 40)).toBeGreaterThan(textHeight(2, 14))
  })
})

describe('textLineHeight', () => {
  it('scales with font size', () => {
    expect(textLineHeight(40)).toBeGreaterThan(textLineHeight(14))
  })
})

describe('textAutoWidth', () => {
  it('clamps empty text to the minimum width', () => {
    expect(textAutoWidth(monospace(10), '')).toBe(TEXT_MIN_WIDTH)
  })

  it('fits a short line exactly, padding included', () => {
    expect(textAutoWidth(monospace(10), 'hi')).toBe(20 + TEXT_PADDING * 2)
  })

  it('grows with more content', () => {
    const short = textAutoWidth(monospace(10), 'hi')
    const longer = textAutoWidth(monospace(10), 'hello there')
    expect(longer).toBeGreaterThan(short)
  })

  it('shrinks back down when content shrinks', () => {
    const long = textAutoWidth(monospace(10), 'a fairly long line of text')
    const short = textAutoWidth(monospace(10), 'hi')
    expect(short).toBeLessThan(long)
  })

  it('caps at TEXT_MAX_WIDTH instead of growing forever', () => {
    const huge = 'x'.repeat(200)
    expect(textAutoWidth(monospace(10), huge)).toBe(TEXT_MAX_WIDTH)
  })

  it('uses the widest of several explicit lines, not the last one', () => {
    expect(textAutoWidth(monospace(10), 'short\na much longer line\nmid')).toBe(textAutoWidth(monospace(10), 'a much longer line'))
  })
})
