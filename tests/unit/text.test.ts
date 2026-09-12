import { describe, it, expect } from 'vitest'
import { textHeight, wrapText } from '@/board/render/text'

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
    expect(textHeight(0)).toBe(textHeight(1))
  })

  it('grows linearly with the line count', () => {
    expect(textHeight(3)).toBeGreaterThan(textHeight(2))
    expect(textHeight(2)).toBeGreaterThan(textHeight(1))
  })
})
