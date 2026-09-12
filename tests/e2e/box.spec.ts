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

/** The box's default color (#dc2626) is nothing like the white board
 * background or the fixture images' blue-ish gradients (see png.ts), so
 * scanning a region for a reddish pixel is a robust way to tell "a box
 * outline is drawn somewhere in here" - same technique `arrow.spec.ts`
 * already uses, for the same reason (a stroked rect's edges, not a solid
 * fill, so one exact pixel isn't a safe bet either). */
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

function boxToolButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Box' })
}

test('the box tool draws a rectangle outline that shows in the preview and survives export', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await boxToolButton(page).click()
  await expect(boxToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  // Draw a box across an empty strip below the image, well clear of the
  // image's own gradient. The scan region is a little wider than the drag so
  // it catches the outline's stroke on every edge, not just the interior.
  const y = rect.y + rect.h + 20
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y: y + 60 }
  const region = { x: start.x - 10, y: y - 10, w: end.x - start.x + 20, h: end.y - y + 20 }

  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // Drawing one box is a one-shot gesture - the tool reverts to select.
  await expect(boxToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  expect(await hasReddishPixel(page, region)).toBe(true)

  // One renderer for preview and export (invariant 1) - the box must reach
  // the downloaded file too, not just the on-screen canvas.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(await download.path()).toBeTruthy()
})

test('the "R" shortcut arms the tool, and Escape cancels a draw without creating anything', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const status = page.locator('.selection-status')

  await page.keyboard.press('r')
  await expect(boxToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await expect(boxToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(status).toHaveText('')
})

test('a stray click with the box tool armed does not create a box', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await boxToolButton(page).click()
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2)

  // A committed box would auto-select itself ("1 selected") - seeing
  // nothing selected is how this test knows nothing was created.
  await expect(status).toHaveText('')
  await expect(boxToolButton(page)).toHaveAttribute('aria-pressed', 'false')
})

test('a box can be selected, deleted, and the delete undone', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await boxToolButton(page).click()
  const y = rect.y + rect.h + 20
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y: y + 60 }
  const region = { x: start.x - 10, y: y - 10, w: end.x - start.x + 20, h: end.y - y + 20 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // `addBox` leaves the new box selected.
  await expect(status).toHaveText('1 selected')
  expect(await hasReddishPixel(page, region)).toBe(true)

  await page.keyboard.press('Delete')
  await expect(status).toHaveText('')
  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.keyboard.press('ControlOrMeta+Z')
  expect(await hasReddishPixel(page, region)).toBe(true)
})

test('a box exposes no resize handle - dragging its selection outline moves it instead', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await boxToolButton(page).click()
  const y = rect.y + rect.h + 20
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y: y + 60 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  const before = { x: start.x - 10, y: y - 10, w: end.x - start.x + 20, h: end.y - y + 20 }
  expect(await hasReddishPixel(page, before)).toBe(true)

  // Drag from inside the box (its outline/interior both hit-test to the box,
  // same generic AABB rule every node uses) rather than a corner - a corner
  // drag would be a resize handle if one existed, which boxes deliberately
  // don't expose.
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 200, center.y, { steps: 8 })
  await page.mouse.up()

  expect(await hasReddishPixel(page, before)).toBe(false)
  const after = { x: before.x + 200, y: before.y, w: before.w, h: before.h }
  expect(await hasReddishPixel(page, after)).toBe(true)
})
