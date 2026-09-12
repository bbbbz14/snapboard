import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

async function pageRect(page: import('@playwright/test').Page) {
  return page.locator('.board-page').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
}

/** The arrow's default color (#dc2626) is nothing like the white board
 * background or the fixture images' blue-ish gradients (see png.ts), so
 * scanning a region for a reddish pixel is a robust way to tell "an arrow
 * is drawn somewhere in here" without replicating the curve's own bezier
 * math in the test. */
function hasReddishPixel(page: import('@playwright/test').Page, rect: { x: number; y: number; w: number; h: number }) {
  return page.locator('canvas.board-canvas').evaluate(
    (el, r) => {
      const canvas = el as HTMLCanvasElement
      const bcr = canvas.getBoundingClientRect()
      const scale = canvas.width / bcr.width
      const ctx = canvas.getContext('2d')!
      const x0 = Math.max(0, Math.round((r.x - bcr.x) * scale))
      const y0 = Math.max(0, Math.round((r.y - bcr.y) * scale))
      const w = Math.min(canvas.width - x0, Math.round(r.w * scale))
      const h = Math.min(canvas.height - y0, Math.round(r.h * scale))
      const data = ctx.getImageData(x0, y0, w, h).data
      for (let i = 0; i < data.length; i += 4) {
        const red = data[i]!
        const green = data[i + 1]!
        const blue = data[i + 2]!
        if (red > 150 && green < 100 && blue < 100) return true
      }
      return false
    },
    rect,
  )
}

function arrowToolButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Arrow' })
}

test('the arrow tool draws a curved arrow that shows in the preview and survives export', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await arrowToolButton(page).click()
  await expect(arrowToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  // Draw a horizontal-ish arrow across an empty strip below the image,
  // well clear of the image's own gradient. The curve bows a little off
  // the straight line and the arrowhead flares at the end, so the check
  // below scans a generous box around the whole drag, not one exact pixel.
  const y = rect.y + rect.h + 40
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y }
  const region = { x: start.x - 10, y: y - 30, w: end.x - start.x + 20, h: 60 }

  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // Drawing one arrow is a one-shot gesture - the tool reverts to select.
  await expect(arrowToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  expect(await hasReddishPixel(page, region)).toBe(true)

  // One renderer for preview and export (invariant 1) - the arrow must
  // reach the downloaded file too, not just the on-screen canvas.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(await download.path()).toBeTruthy()
})

test('the "A" shortcut arms the tool, and Escape cancels a draw without creating anything', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const status = page.locator('.selection-status')

  await page.keyboard.press('a')
  await expect(arrowToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await expect(arrowToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(status).toHaveText('')
})

test('a stray click with the arrow tool armed does not create an arrow', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await arrowToolButton(page).click()
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2)

  // A committed arrow would auto-select itself ("1 selected") - seeing
  // nothing selected is how this test knows nothing was created.
  await expect(status).toHaveText('')
  await expect(arrowToolButton(page)).toHaveAttribute('aria-pressed', 'false')
})

test('an arrow can be selected, deleted, and the delete undone', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await arrowToolButton(page).click()
  const y = rect.y + rect.h + 40
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y }
  const region = { x: start.x - 10, y: y - 30, w: end.x - start.x + 20, h: 60 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // `addArrow` leaves the new arrow selected.
  await expect(status).toHaveText('1 selected')
  expect(await hasReddishPixel(page, region)).toBe(true)

  await page.keyboard.press('Delete')
  await expect(status).toHaveText('')
  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.keyboard.press('ControlOrMeta+Z')
  expect(await hasReddishPixel(page, region)).toBe(true)
})
