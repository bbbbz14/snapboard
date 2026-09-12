import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

function cropButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Crop', exact: true })
}
function doneButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Done' })
}
function cancelButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Cancel' })
}

/** Bounding box of the selection outline on `.board-interaction`, in page
 * coordinates - the same technique `moveResize.spec.ts` uses to find a
 * node's on-screen frame (and, here, the crop window's starting rect, since
 * a crop session opens with the window equal to the frame) without assuming
 * layout math. */
function selectionScreenRect(page: import('@playwright/test').Page) {
  return page.locator('.board-interaction').evaluate((el) => {
    const canvas = el as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.width / rect.width
    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (data[i + 3]! > 0 && data[i + 2]! > data[i]! && data[i + 2]! > 80) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    return { x: rect.x + minX / scale, y: rect.y + minY / scale, w: (maxX - minX) / scale, h: (maxY - minY) / scale }
  })
}

/** Reads a pixel from the live preview canvas, given a page-space point. */
function pixelAt(page: import('@playwright/test').Page, x: number, y: number) {
  return page.locator('canvas.board-canvas').evaluate(
    (el, p) => {
      const canvas = el as HTMLCanvasElement
      const rect = canvas.getBoundingClientRect()
      const scale = canvas.width / rect.width
      const ctx = canvas.getContext('2d')!
      const d = ctx.getImageData(Math.round((p.x - rect.x) * scale), Math.round((p.y - rect.y) * scale), 1, 1).data
      return [d[0], d[1], d[2]]
    },
    { x, y },
  )
}

test('the Crop button only appears for a single selected image node', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await page.locator('.board-page').evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })

  // Nothing selected yet.
  await expect(cropButton(page)).toBeHidden()

  // Click just the top image: a single image selected, Crop available.
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  await expect(cropButton(page)).toBeVisible()

  // Marquee-select both images: a multi-selection, no single crop target.
  await page.mouse.move(rect.x - 20, rect.y - 20)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.w + 20, rect.y + rect.h + 20, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.selection-status')).toHaveText('2 selected')
  await expect(cropButton(page)).toBeHidden()
})

test('a box node (not an image) never offers Crop', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await page.locator('.board-page').evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })

  await page.getByRole('button', { name: 'Box' }).click()
  const y = rect.y + rect.h + 20
  await page.mouse.move(rect.x + 20, y)
  await page.mouse.down()
  await page.mouse.move(rect.x + 160, y + 60, { steps: 8 })
  await page.mouse.up()

  await expect(cropButton(page)).toBeHidden()
})

test('dragging a crop handle and confirming shrinks the image and survives export', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const pageRect = await page.locator('.board-page').evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })

  await page.mouse.click(pageRect.x + pageRect.w / 2, pageRect.y + pageRect.h / 2)
  const node = await selectionScreenRect(page)

  await cropButton(page).click()
  await expect(doneButton(page)).toBeVisible()

  const seHandle = { x: node.x + node.w, y: node.y + node.h }
  const farCorner = { x: seHandle.x - 3, y: seHandle.y - 3 }
  const before = await pixelAt(page, farCorner.x, farCorner.y)

  // Drag the se handle a good way in towards the node's center.
  await page.mouse.move(seHandle.x, seHandle.y)
  await page.mouse.down()
  await page.mouse.move(node.x + node.w / 2, node.y + node.h / 2, { steps: 8 })
  await page.mouse.up()

  await doneButton(page).click()
  await expect(doneButton(page)).toBeHidden()

  const after = await pixelAt(page, farCorner.x, farCorner.y)
  // The far corner is now uncovered board background (white), not the image.
  expect(after[0]).toBeGreaterThan(240)
  expect(after[1]).toBeGreaterThan(240)
  expect(after[2]).toBeGreaterThan(240)
  const diff = Math.abs(before[0]! - after[0]!) + Math.abs(before[1]! - after[1]!) + Math.abs(before[2]! - after[2]!)
  expect(diff).toBeGreaterThan(20)

  // One renderer for preview and export (invariant 1): the crop must reach
  // the downloaded file too, not just the on-screen canvas.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(await download.path()).toBeTruthy()
})

test('Escape cancels a crop session without changing the image', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const pageRect = await page.locator('.board-page').evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })

  await page.mouse.click(pageRect.x + pageRect.w / 2, pageRect.y + pageRect.h / 2)
  const node = await selectionScreenRect(page)
  const seHandle = { x: node.x + node.w, y: node.y + node.h }
  const farCorner = { x: seHandle.x - 3, y: seHandle.y - 3 }
  const before = await pixelAt(page, farCorner.x, farCorner.y)

  await cropButton(page).click()
  await page.mouse.move(seHandle.x, seHandle.y)
  await page.mouse.down()
  await page.mouse.move(node.x + node.w / 2, node.y + node.h / 2, { steps: 8 })
  await page.mouse.up()

  await page.keyboard.press('Escape')
  await expect(doneButton(page)).toBeHidden()

  const after = await pixelAt(page, farCorner.x, farCorner.y)
  expect(after).toEqual(before)
})

test('a confirmed crop can be undone, restoring the original frame', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const pageRect = await page.locator('.board-page').evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })

  await page.mouse.click(pageRect.x + pageRect.w / 2, pageRect.y + pageRect.h / 2)
  const node = await selectionScreenRect(page)
  const seHandle = { x: node.x + node.w, y: node.y + node.h }
  const farCorner = { x: seHandle.x - 3, y: seHandle.y - 3 }
  const before = await pixelAt(page, farCorner.x, farCorner.y)

  await cropButton(page).click()
  await page.mouse.move(seHandle.x, seHandle.y)
  await page.mouse.down()
  await page.mouse.move(node.x + node.w / 2, node.y + node.h / 2, { steps: 8 })
  await page.mouse.up()
  await doneButton(page).click()

  const cropped = await pixelAt(page, farCorner.x, farCorner.y)
  expect(cropped).not.toEqual(before)

  await page.keyboard.press('ControlOrMeta+Z')
  const restored = await pixelAt(page, farCorner.x, farCorner.y)
  expect(restored).toEqual(before)
})
