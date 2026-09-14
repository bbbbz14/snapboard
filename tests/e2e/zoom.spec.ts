import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the zoom indicator reflects manual zoom, and fit resets it', async ({ page, images, addViaPicker }) => {
  // Small enough that fit-to-view never scales it below 100%.
  await addViaPicker(page, images([[400, 300]]))
  const pct = page.locator('.zoom-pct')
  await expect(pct).toHaveText('100%')

  await page.locator('.zoom-btn').filter({ hasText: '+' }).click()
  await expect(pct).toHaveText('120%')
  await page.locator('.zoom-btn').filter({ hasText: '+' }).click()
  await expect(pct).toHaveText('144%')

  await page.locator('.zoom-fit').click()
  await expect(pct).toHaveText('100%')

  await page.locator('.zoom-btn').filter({ hasText: '+' }).click()
  await expect(pct).not.toHaveText('100%')
  // Clicking the percentage itself resets to 100%, a separate action from fit.
  await pct.click()
  await expect(pct).toHaveText('100%')
})

test('keyboard shortcuts zoom in, out, fit, and reset to 100%', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const pct = page.locator('.zoom-pct')
  await page.locator('canvas.board-canvas').click({ position: { x: 5, y: 5 } })

  await page.keyboard.press('+')
  await expect(pct).toHaveText('120%')
  await page.keyboard.press('-')
  await expect(pct).toHaveText('100%')

  await page.keyboard.press('+')
  await page.keyboard.press('+')
  await expect(pct).toHaveText('144%')
  await page.keyboard.press('1')
  await expect(pct).toHaveText('100%')
  await page.keyboard.press('0')
  await expect(pct).toHaveText('100%')
})

test('zooming and panning the preview never changes the exported file', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[900, 600], [600, 900]]))

  const downloadOnce = async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download' }).click(),
    ])
    return readFileSync((await download.path())!)
  }

  const before = await downloadOnce()

  // Zoom in, then pan with the wheel and a middle-drag - none of this should
  // reach the exported pixels, since exportBoard never sets renderScene's
  // preview-only `offset` option.
  await page.locator('.zoom-btn').filter({ hasText: '+' }).click()
  await page.locator('.zoom-btn').filter({ hasText: '+' }).click()
  await page.mouse.move(600, 400)
  await page.mouse.wheel(40, 60)
  await page.mouse.move(600, 400)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(500, 300)
  await page.mouse.up({ button: 'middle' })

  const after = await downloadOnce()
  expect(after.equals(before)).toBe(true)
})

test('scrolling the wheel for a long time does not pan the board an unbounded distance away', async ({
  page,
  images,
  addViaPicker,
}) => {
  // The exact bug this guards against: a plain wheel scroll used to have no
  // pan limit at all (camera.ts's panBy has no board-size awareness), so
  // scrolling down for a while could carry the board arbitrarily far
  // off-screen with fit-to-view as the only way back.
  await addViaPicker(page, images([[400, 300]]))

  const boardPage = page.locator('.board-page')
  await page.mouse.move(600, 400)
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 2000)
  }

  // However far the scroll went, some part of the board must still intersect
  // the viewport - i.e. the board is still reachable without hunting for it.
  const viewport = page.viewportSize()!
  const rect = await boardPage.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  expect(rect.y).toBeLessThan(viewport.height)
  expect(rect.y + rect.h).toBeGreaterThan(0)

  // Scrolling further in the same direction changes nothing once clamped.
  const before = await boardPage.evaluate((el) => el.getBoundingClientRect().y)
  await page.mouse.wheel(0, 2000)
  const after = await boardPage.evaluate((el) => el.getBoundingClientRect().y)
  expect(after).toBe(before)
})
