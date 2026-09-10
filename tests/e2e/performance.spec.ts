import { test, expect } from './fixtures'

/**
 * Measures the latency the app itself adds to the core loop. Human
 * Time-To-Copy still has to be measured with real people; this guards the part
 * a machine can observe, so a regression cannot hide behind "it feels fine".
 *
 * WebKit gets its own budget: Phase 0 measured decoding there at ~4x the cost
 * of Chromium (ADR-004).
 */
const BUDGET_MS = {
  chromium: { small: 1500, batch: 8000, copy: 2500 },
  firefox: { small: 2000, batch: 10_000, copy: 2500 },
  webkit: { small: 3000, batch: 20_000, copy: 5000 },
} as const

const budget = (name: string) => BUDGET_MS[name as keyof typeof BUDGET_MS] ?? BUDGET_MS.chromium

test('three screenshots are on the board almost immediately', async ({
  page,
  images,
  addViaPicker,
  browserName,
}) => {
  await page.goto('/')
  const paths = images([
    [1600, 1000],
    [1600, 1000],
    [1600, 1000],
  ])

  const started = Date.now()
  await addViaPicker(page, paths)
  await expect(page.getByRole('img', { name: /Board with 3 images/ })).toBeVisible()
  const elapsed = Date.now() - started

  console.log(`[${browserName}] 3 images ready in ${elapsed} ms`)
  expect(elapsed).toBeLessThan(budget(browserName).small)
})

test('a dozen large screenshots stay within budget and keep the UI alive', async ({
  page,
  images,
  addViaPicker,
  browserName,
}) => {
  await page.goto('/')
  const paths = images(Array.from({ length: 12 }, () => [1920, 1080] as [number, number]))

  const started = Date.now()
  await addViaPicker(page, paths)
  await expect(page.getByRole('img', { name: /Board with 12 images/ })).toBeVisible()
  const elapsed = Date.now() - started

  console.log(`[${browserName}] 12 x 1920x1080 ready in ${elapsed} ms`)
  expect(elapsed).toBeLessThan(budget(browserName).batch)

  // The board must still respond straight after a heavy ingest.
  const switched = Date.now()
  await page.getByRole('button', { name: 'Grid' }).click()
  await expect(page.locator('canvas.board-canvas')).toBeVisible()
  console.log(`[${browserName}] relayout after 12 images in ${Date.now() - switched} ms`)
})

test('copy completes quickly enough to feel instant', async ({ page, images, addViaPicker, browserName }) => {
  await page.goto('/')
  await addViaPicker(page, images([
    [1600, 1000],
    [1600, 1000],
    [1600, 1000],
  ]))

  const started = Date.now()
  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByRole('button', { name: /Copied|Copy/ })).toBeVisible()
  await page.waitForFunction(() => !!document.querySelector('.toast'))
  const elapsed = Date.now() - started

  console.log(`[${browserName}] copy round trip in ${elapsed} ms`)
  expect(elapsed).toBeLessThan(budget(browserName).copy)
})

test('the shipped bundle stays small', async ({ page }) => {
  const sizes: number[] = []
  page.on('response', async (res) => {
    const type = res.headers()['content-type'] ?? ''
    if (!/javascript|css/.test(type)) return
    const body = await res.body().catch(() => null)
    if (body) sizes.push(body.length)
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const total = sizes.reduce((a, b) => a + b, 0)
  console.log(`transferred JS+CSS: ${(total / 1024).toFixed(0)} kB uncompressed`)
  expect(total).toBeLessThan(900 * 1024)
})
