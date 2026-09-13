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

/** The marker's default color (#dc2626) is nothing like the white board
 * background or the fixture images' blue-ish gradients (see png.ts), so
 * scanning a region for a reddish pixel is a robust way to tell "a marker
 * is drawn somewhere in here" - same technique arrow.spec.ts/box.spec.ts
 * already use, for the same reason (a filled circle plus a white ring and
 * digit isn't one predictable pixel either). */
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

function markerToolButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Number' })
}

/** A 40x40 box around a click point comfortably covers the 36px marker
 * circle centered there, regardless of pixel-ratio rounding. */
function regionAround(point: { x: number; y: number }) {
  return { x: point.x - 20, y: point.y - 20, w: 40, h: 40 }
}

test('the marker tool places a numbered circle on a single click and survives export', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const at = { x: rect.x + 20, y: rect.y + rect.h + 30 }
  const region = regionAround(at)

  await markerToolButton(page).click()
  await expect(markerToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.mouse.click(at.x, at.y)

  // A single click commits it - a marker has no drag/size to draw, unlike
  // arrow/box - so the tool reverts to select immediately.
  await expect(markerToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.selection-status')).toHaveText('1 selected')
  expect(await hasReddishPixel(page, region)).toBe(true)

  // One renderer for preview and export (invariant 1) - the marker must
  // reach the downloaded file too, not just the on-screen canvas.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(await download.path()).toBeTruthy()
})

test('the "N" shortcut arms the tool, and Escape cancels the armed tool', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const status = page.locator('.selection-status')

  await page.keyboard.press('n')
  await expect(markerToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await expect(markerToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(status).toHaveText('')
})

// The actual digit shown (renumbering after a delete) is covered by the unit
// suite's `toRenderInput` assertions - a pixel scan here can tell a marker
// is present or gone, but can't reliably distinguish "1" from "2" by color.
test('placing two markers and deleting one leaves only the other', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const first = { x: rect.x + 20, y: rect.y + rect.h + 30 }
  const second = { x: rect.x + 20, y: rect.y + rect.h + 100 }

  await markerToolButton(page).click()
  await page.mouse.click(first.x, first.y)
  await markerToolButton(page).click()
  await page.mouse.click(second.x, second.y)

  expect(await hasReddishPixel(page, regionAround(first))).toBe(true)
  expect(await hasReddishPixel(page, regionAround(second))).toBe(true)

  // Select and delete the first marker (it's the only one at that point).
  await page.mouse.click(first.x, first.y)
  await expect(page.locator('.selection-status')).toHaveText('1 selected')
  await page.keyboard.press('Delete')

  expect(await hasReddishPixel(page, regionAround(first))).toBe(false)
  expect(await hasReddishPixel(page, regionAround(second))).toBe(true)
})

test('a marker can be selected, deleted, and the delete undone', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const at = { x: rect.x + 20, y: rect.y + rect.h + 30 }
  const region = regionAround(at)
  const status = page.locator('.selection-status')

  await markerToolButton(page).click()
  await page.mouse.click(at.x, at.y)

  await expect(status).toHaveText('1 selected')
  expect(await hasReddishPixel(page, region)).toBe(true)

  await page.keyboard.press('Delete')
  await expect(status).toHaveText('')
  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.keyboard.press('ControlOrMeta+Z')
  expect(await hasReddishPixel(page, region)).toBe(true)
})

test('a marker exposes no resize handle - dragging it moves it instead', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  // Placed well inside the image, not below it - a point outside the image
  // would extend the board's own content bounding box, which a later drag of
  // the marker would then shrink back down (fitBoardToContent), resizing and
  // refitting the board mid-test and invalidating every page-pixel
  // coordinate computed from `rect` below it.
  const at = { x: rect.x + 30, y: rect.y + 30 }

  await markerToolButton(page).click()
  await page.mouse.click(at.x, at.y)

  const before = regionAround(at)
  expect(await hasReddishPixel(page, before)).toBe(true)

  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  await page.mouse.move(at.x + 150, at.y, { steps: 8 })
  await page.mouse.up()

  expect(await hasReddishPixel(page, before)).toBe(false)
  const after = regionAround({ x: at.x + 150, y: at.y })
  expect(await hasReddishPixel(page, after)).toBe(true)
})
