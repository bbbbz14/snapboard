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
