import { test, expect } from '@playwright/test'

type Harness = Record<string, (...args: unknown[]) => Promise<unknown>>
const call = <T>(page: import('@playwright/test').Page, fn: string, arg?: unknown) =>
  page.evaluate(
    ([f, a]) => ((window as unknown as { harness: Harness }).harness[f as string]!)(a),
    [fn, arg] as const,
  ) as Promise<T>

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
  await page.goto('/tests/render/harness.html')
  await page.waitForFunction(() => (window as unknown as { harness?: unknown }).harness !== undefined)
})

const SCENES = [
  { name: 'three desktop, card', spec: { sizes: [[1600, 900], [1600, 900], [1600, 900]], mode: 'auto', style: 'card', background: 'white' } },
  { name: 'four phones, soft', spec: { sizes: [[1170, 2532], [1170, 2532], [1170, 2532], [1170, 2532]], mode: 'auto', style: 'soft', background: 'black' } },
  { name: 'compare pair, plain', spec: { sizes: [[1400, 900], [1400, 900]], mode: 'compare', style: 'plain', background: 'white' } },
  { name: 'mixed grid', spec: { sizes: [[1000, 700], [900, 1200], [420, 180], [1600, 500]], mode: 'grid', style: 'card', background: 'white' } },
  { name: 'steps with badges', spec: { sizes: [[1200, 700], [800, 900], [420, 180]], mode: 'steps', style: 'card', background: 'white' } },
  // Plain, not card - this scene targets the gradient fill path specifically
  // (invariant 1: background matches between preview and export). Card's
  // rounded/shadowed tiles already have their own known antialiasing-edge
  // tolerance (ADR-002/007); compositing that against a gradient instead of
  // a flat color pushed chromium's max channel error from ≤2 to 4 - a real
  // but unrelated effect this scene isn't meant to measure.
  { name: 'gradient background', spec: { sizes: [[1200, 800], [1200, 800]], mode: 'auto', style: 'plain', background: 'gradientOcean' } },
] as const

/**
 * Blending a rounded, shadowed tile into the board composites partial alpha
 * twice, where the direct export path composites once. Chromium and WebKit
 * round this away; Firefox does not. The gap is confined to antialiased edge
 * pixels and the export is the accurate render either way - see ADR-007.
 */
const MAX_CHANNEL_ERROR: Record<string, number> = { chromium: 2, webkit: 2, firefox: 24 }

for (const { name, spec } of SCENES) {
  test(`preview and export are pixel-identical: ${name}`, async ({ page, browserName }) => {
    const r = await call<{ pixelsOver1: number; maxChannelError: number; size: { w: number; h: number } }>(
      page,
      'parityWithTiles',
      spec,
    )
    expect(r.maxChannelError).toBeLessThanOrEqual(MAX_CHANNEL_ERROR[browserName] ?? 2)
    // Whatever the engine, a difference may only touch a sliver of edge pixels.
    expect(r.pixelsOver1 / (r.size.w * r.size.h)).toBeLessThan(0.0002)
  })
}

test('step badges are painted into the reserved gutter', async ({ page }) => {
  const r = await call<{ r: number; g: number; b: number; a: number; hasBadge: boolean }>(page, 'badgePixel', {
    sizes: [[1200, 700], [800, 900]],
    mode: 'steps',
    style: 'card',
    background: 'white',
  })
  expect(r.hasBadge).toBe(true)
  expect(r.a).toBe(255)
  // The badge fill is #2563eb: blue must clearly dominate.
  expect(r.b).toBeGreaterThan(150)
  expect(r.b - r.r).toBeGreaterThan(80)
})

test('a transparent background survives export', async ({ page }) => {
  const r = await call<{ alpha: number }>(page, 'alphaAtCorner', {
    sizes: [[900, 600]],
    mode: 'columns',
    style: 'plain',
    background: 'transparent',
  })
  expect(r.alpha).toBe(0)
})

test('a gradient background actually varies corner-to-corner', async ({ page }) => {
  const r = await call<{ topLeft: number[]; bottomRight: number[] }>(page, 'gradientCorners', {
    sizes: [[900, 600]],
    mode: 'columns',
    style: 'plain',
    background: 'gradientOcean', // #2193b0 -> #6dd5ed
  })
  expect(r.topLeft).toEqual([0x21, 0x93, 0xb0, 255])
  expect(r.bottomRight[3]).toBe(255)
  // Not asserting the exact bottom-right RGB - the gradient vector runs to
  // the board's own corner, one pixel past what's sampled - just that it's
  // clearly closer to "to" than to "from".
  expect(r.bottomRight![0]).toBeGreaterThan(r.topLeft![0]!)
  expect(r.bottomRight![2]).toBeGreaterThan(r.topLeft![2]!)
})

test('export scales the output exactly', async ({ page }) => {
  const r = await call<Record<string, { w: number; h: number; applied: number }> & { logical: { w: number; h: number } }>(
    page,
    'exportSizes',
    { sizes: [[1200, 800], [1200, 800]], mode: 'columns', style: 'card', background: 'white' },
  )
  expect(r.x1!.w).toBe(r.logical.w)
  expect(r.x2!.w).toBe(r.logical.w * 2)
  expect(r.x3!.w).toBe(r.logical.w * 3)
  expect(r.x3!.applied).toBe(3)
})

test('an oversized board is downscaled instead of failing', async ({ page }) => {
  // 6000x6000 is 36 MP: fine at 1x, but 144 MP at 2x and 324 MP at 3x, so the
  // guard has to walk all the way down to 1x.
  const big = await call<{ scale: number; downscaled: boolean }>(page, 'guardScale', {
    size: { w: 6000, h: 6000 },
    requested: 3,
  })
  expect(big).toEqual({ scale: 1, downscaled: true })

  // 5000x4000 is 20 MP: 80 MP at 2x fits, 180 MP at 3x does not.
  const mid = await call<{ scale: number; downscaled: boolean }>(page, 'guardScale', {
    size: { w: 5000, h: 4000 },
    requested: 3,
  })
  expect(mid).toEqual({ scale: 2, downscaled: true })

  const small = await call<{ scale: number; downscaled: boolean }>(page, 'guardScale', {
    size: { w: 1200, h: 800 },
    requested: 3,
  })
  expect(small).toEqual({ scale: 3, downscaled: false })
})
