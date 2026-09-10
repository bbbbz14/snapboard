import { describe, it, expect } from 'vitest'
import { computeLayout, pickAutoMode, type LayoutItem, type LayoutOptions } from '@/board/layout/computeLayout'

const opts: LayoutOptions = { gap: 20, padding: 32, targetWidth: 1200, columns: null }

const item = (id: string, w: number, h: number): LayoutItem => ({ id, natural: { w, h } })

/** Realistic fixtures — these are the shapes the product actually receives. */
const DESKTOP = (id: string) => item(id, 2560, 1440)
const PHONE = (id: string) => item(id, 1170, 2532)
const DIALOG = (id: string) => item(id, 420, 180)
const SQUARE = (id: string) => item(id, 1000, 1000)

describe('pickAutoMode', () => {
  it('pairs two similar images for comparison', () => {
    expect(pickAutoMode([DESKTOP('a'), DESKTOP('b')])).toBe('compare')
  })

  it('does not force comparison on two mismatched images', () => {
    expect(pickAutoMode([DESKTOP('a'), PHONE('b')])).not.toBe('compare')
  })

  it('lays phone screenshots out in a row, not a stack', () => {
    expect(pickAutoMode([PHONE('a'), PHONE('b'), PHONE('c')])).toBe('rows')
  })

  it('stacks wide desktop captures so each stays readable', () => {
    expect(pickAutoMode([DESKTOP('a'), DESKTOP('b'), DESKTOP('c')])).toBe('columns')
  })

  it('tiles four similar images into a grid', () => {
    expect(pickAutoMode([SQUARE('a'), SQUARE('b'), SQUARE('c'), SQUARE('d')])).toBe('grid')
  })

  it('falls back to rows for mixed shapes', () => {
    expect(pickAutoMode([DESKTOP('a'), PHONE('b'), DIALOG('c')])).toBe('rows')
  })

  it('treats a single image as a column', () => {
    expect(pickAutoMode([DESKTOP('a')])).toBe('columns')
  })
})

describe('computeLayout invariants', () => {
  const cases: [string, LayoutItem[]][] = [
    ['single desktop', [DESKTOP('a')]],
    ['two desktop', [DESKTOP('a'), DESKTOP('b')]],
    ['three phones', [PHONE('a'), PHONE('b'), PHONE('c')]],
    ['four squares', [SQUARE('a'), SQUARE('b'), SQUARE('c'), SQUARE('d')]],
    ['mixed', [DESKTOP('a'), PHONE('b'), DIALOG('c'), SQUARE('d')]],
    ['seven mixed', [DESKTOP('a'), PHONE('b'), DIALOG('c'), SQUARE('d'), DESKTOP('e'), PHONE('f'), SQUARE('g')]],
  ]

  for (const [name, items] of cases) {
    describe(name, () => {
      const r = computeLayout(items, 'auto', opts)

      it('places every item exactly once', () => {
        expect(Object.keys(r.frames).sort()).toEqual(items.map((i) => i.id).sort())
      })

      it('keeps every frame inside the canvas', () => {
        for (const f of Object.values(r.frames)) {
          expect(f.x).toBeGreaterThanOrEqual(0)
          expect(f.y).toBeGreaterThanOrEqual(0)
          expect(f.x + f.w).toBeLessThanOrEqual(r.size.w + 1)
          expect(f.y + f.h).toBeLessThanOrEqual(r.size.h + 1)
        }
      })

      it('respects the padding on all sides', () => {
        const xs = Object.values(r.frames)
        expect(Math.min(...xs.map((f) => f.x))).toBe(opts.padding)
        expect(Math.min(...xs.map((f) => f.y))).toBe(opts.padding)
      })

      it('preserves each aspect ratio within 1%', () => {
        for (const it of items) {
          const f = r.frames[it.id]!
          const want = it.natural.w / it.natural.h
          expect(Math.abs(f.w / f.h - want) / want).toBeLessThan(0.01)
        }
      })

      it('never upscales an image beyond its own pixels', () => {
        for (const it of items) {
          const f = r.frames[it.id]!
          expect(f.w).toBeLessThanOrEqual(it.natural.w + 1)
          expect(f.h).toBeLessThanOrEqual(it.natural.h + 1)
        }
      })

      it('never overlaps two frames', () => {
        const fs = Object.values(r.frames)
        for (let i = 0; i < fs.length; i++) {
          for (let j = i + 1; j < fs.length; j++) {
            const a = fs[i]!
            const b = fs[j]!
            const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
            expect(overlap).toBe(false)
          }
        }
      })
    })
  }
})

describe('computeLayout specifics', () => {
  it('returns an empty board size when there is nothing to lay out', () => {
    const r = computeLayout([], 'auto', opts)
    expect(r.frames).toEqual({})
    expect(r.size.w).toBe(opts.targetWidth)
  })

  it('aligns a compare pair on a shared baseline', () => {
    const r = computeLayout([DESKTOP('a'), DESKTOP('b')], 'compare', opts)
    expect(r.frames.a!.y).toBe(r.frames.b!.y)
    expect(r.frames.a!.h).toBe(r.frames.b!.h)
  })

  it('leaves a gutter for step numbers', () => {
    const r = computeLayout([DESKTOP('a'), DESKTOP('b')], 'steps', opts)
    expect(r.frames.a!.x).toBeGreaterThan(opts.padding)
  })

  it('honours an explicit grid column count', () => {
    const items = [SQUARE('a'), SQUARE('b'), SQUARE('c'), SQUARE('d')]
    const r = computeLayout(items, 'grid', { ...opts, columns: 4 })
    const ys = Object.values(r.frames).map((f) => f.y)
    expect(new Set(ys).size).toBe(1)
  })

  it('keeps a tiny dialog at its own size instead of blowing it up', () => {
    const r = computeLayout([DIALOG('a')], 'columns', opts)
    expect(r.frames.a!.w).toBe(420)
  })

  it('grows the canvas with the number of images', () => {
    const small = computeLayout([DESKTOP('a')], 'columns', opts)
    const big = computeLayout([DESKTOP('a'), DESKTOP('b'), DESKTOP('c')], 'columns', opts)
    expect(big.size.h).toBeGreaterThan(small.size.h)
  })
})
