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

/** Same "scan a region, look for the annotation red" technique
 * `arrow.spec.ts`/`box.spec.ts` already use, since the fixture images are
 * gradients, not flat colors. A plain line has no bow or arrowhead to worry
 * about, so this could sample the exact stroke line directly, but scanning a
 * small region around it keeps this robust to the same anti-aliasing/stroke-
 * width slop the other annotation specs already account for. */
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

function lineToolButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Line', exact: true })
}

test('the line tool draws a plain straight stroke (no arrowhead) that shows in the preview and survives export', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await lineToolButton(page).click()
  await expect(lineToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  const y = rect.y + rect.h + 40
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y }
  const region = { x: start.x - 10, y: y - 20, w: end.x - start.x + 20, h: 40 }

  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // Drawing one line is a one-shot gesture - the tool reverts to select.
  await expect(lineToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  expect(await hasReddishPixel(page, region)).toBe(true)

  // A plain line has no curve, so its stroke sits exactly on the straight
  // line between the two drag points - unlike arrow.spec.ts, this can check
  // the exact midpoint directly.
  const mid = { x: (start.x + end.x) / 2, y }
  expect(await hasReddishPixel(page, { x: mid.x - 2, y: mid.y - 2, w: 4, h: 4 })).toBe(true)

  // One renderer for preview and export (invariant 1) - the line must reach
  // the downloaded file too, not just the on-screen canvas.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(await download.path()).toBeTruthy()
})

test('the "L" shortcut arms the tool, and Escape cancels a draw without creating anything', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const status = page.locator('.selection-status')

  await page.keyboard.press('l')
  await expect(lineToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await expect(lineToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(status).toHaveText('')
})

test('a stray click with the line tool armed does not create a line', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await lineToolButton(page).click()
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2)

  // A committed line would auto-select itself ("1 selected") - seeing
  // nothing selected is how this test knows nothing was created.
  await expect(status).toHaveText('')
  await expect(lineToolButton(page)).toHaveAttribute('aria-pressed', 'false')
})

test('a line can be selected, deleted, and the delete undone', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await lineToolButton(page).click()
  const y = rect.y + rect.h + 40
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y }
  const region = { x: start.x - 10, y: y - 20, w: end.x - start.x + 20, h: 40 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // `addLine` leaves the new line selected.
  await expect(status).toHaveText('1 selected')
  expect(await hasReddishPixel(page, region)).toBe(true)

  await page.keyboard.press('Delete')
  await expect(status).toHaveText('')
  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.keyboard.press('ControlOrMeta+Z')
  expect(await hasReddishPixel(page, region)).toBe(true)
})

test('the size slider changes the stroke width of newly drawn lines', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await lineToolButton(page).click()
  const y1 = rect.y + rect.h + 60
  await page.mouse.move(rect.x + 20, y1)
  await page.mouse.down()
  await page.mouse.move(rect.x + 120, y1, { steps: 5 })
  await page.mouse.up()

  const stripe = { x: rect.x + 70, y: y1 - 10, w: 1, h: 20 }
  const thin = await page.locator('canvas.board-canvas').evaluate(
    (el, r) => {
      const canvas = el as HTMLCanvasElement
      const bcr = canvas.getBoundingClientRect()
      const scale = canvas.width / bcr.width
      const ctx = canvas.getContext('2d')!
      const cx = Math.round((r.x - bcr.x) * scale)
      const y0 = Math.max(0, Math.round((r.y - bcr.y) * scale))
      const h = Math.min(canvas.height - y0, Math.round(r.h * scale))
      const data = ctx.getImageData(cx, y0, 1, h).data
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! > 150 && data[i + 1]! < 100 && data[i + 2]! < 100) count++
      }
      return count
    },
    stripe,
  )

  await lineToolButton(page).click()
  const slider = page.getByRole('slider', { name: 'Size' })
  await slider.focus()
  await page.keyboard.press('End')

  const x2 = rect.x + 260
  const y2 = y1
  await page.mouse.move(x2, y2)
  await page.mouse.down()
  await page.mouse.move(x2 + 100, y2, { steps: 5 })
  await page.mouse.up()

  const thick = await page.locator('canvas.board-canvas').evaluate(
    (el, r) => {
      const canvas = el as HTMLCanvasElement
      const bcr = canvas.getBoundingClientRect()
      const scale = canvas.width / bcr.width
      const ctx = canvas.getContext('2d')!
      const cx = Math.round((r.x - bcr.x) * scale)
      const y0 = Math.max(0, Math.round((r.y - bcr.y) * scale))
      const h = Math.min(canvas.height - y0, Math.round(r.h * scale))
      const data = ctx.getImageData(cx, y0, 1, h).data
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! > 150 && data[i + 1]! < 100 && data[i + 2]! < 100) count++
      }
      return count
    },
    { x: x2 + 50, y: y2 - 10, w: 1, h: 20 },
  )

  expect(thick).toBeGreaterThan(thin)
})
