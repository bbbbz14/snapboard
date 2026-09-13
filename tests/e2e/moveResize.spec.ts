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

/** Reads a pixel from the live preview canvas, given a page-space point -
 * no PNG decoding needed. Converts to the canvas's own backing-store pixel
 * coordinates first: getImageData needs canvas-local px, not page px, and
 * the canvas sits below the top bar (see BoardCanvas.tsx's viewport prop). */
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

/** Bounding box of the selection outline on `.board-interaction`, in page
 * coordinates - lets a test find a resize handle without assuming layout
 * math, since the interaction canvas draws the outline exactly at the
 * node's current frame. */
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

test('dragging a node moves it, and the move survives export (invariant 1)', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await pageRect(page)
  const topCenter = { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.25 }

  const before = await pixelAt(page, topCenter.x, topCenter.y)

  // Drag the top image down to the very bottom of the board.
  await page.mouse.move(topCenter.x, topCenter.y)
  await page.mouse.down()
  await page.mouse.move(topCenter.x, rect.y + rect.h - 10, { steps: 8 })
  await page.mouse.up()

  const after = await pixelAt(page, topCenter.x, topCenter.y)
  const diff = Math.abs(before[0]! - after[0]!) + Math.abs(before[1]! - after[1]!) + Math.abs(before[2]! - after[2]!)
  expect(diff).toBeGreaterThan(20)

  // The commit went through the store, so it renders on export too.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(await download.path()).toBeTruthy()
})

test('shrinking from a corner handle uncovers the board behind it, if something else still anchors the board edge', async ({ page, images, addViaPicker }) => {
  // Two images stacked, not one - with only one node on the board, shrinking
  // it now also shrinks the whole board to fit (fitBoardToContent, see the
  // dedicated test below), leaving nothing to "uncover". With a second,
  // untouched node still anchoring the board's bottom edge, shrinking the
  // top node away from it stays a pure reveal - the board itself doesn't
  // resize because the bounding box's bottom edge is unaffected.
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Plain' }).click()
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await pageRect(page)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  const node = await selectionScreenRect(page)
  const seHandle = { x: node.x + node.w, y: node.y + node.h }

  const farCorner = { x: seHandle.x - 3, y: seHandle.y - 3 }
  const before = await pixelAt(page, farCorner.x, farCorner.y)

  // Drag the se handle inward to shrink the top image toward its own center.
  await page.mouse.move(seHandle.x, seHandle.y)
  await page.mouse.down()
  await page.mouse.move(node.x + node.w / 2, node.y + node.h / 2, { steps: 8 })
  await page.mouse.up()

  const after = await pixelAt(page, farCorner.x, farCorner.y)
  // The far corner is now uncovered board background (white), not the image.
  expect(after[0]).toBeGreaterThan(240)
  expect(after[1]).toBeGreaterThan(240)
  expect(after[2]).toBeGreaterThan(240)
  const diff = Math.abs(before[0]! - after[0]!) + Math.abs(before[1]! - after[1]!) + Math.abs(before[2]! - after[2]!)
  expect(diff).toBeGreaterThan(20)
  // And the board itself didn't resize - the bottom image still anchors its
  // bounding box edge, so there was nothing for fitBoardToContent to trim.
  const rectAfter = await pageRect(page)
  expect(Math.round(rectAfter.w)).toBe(Math.round(rect.w))
  expect(Math.round(rectAfter.h)).toBe(Math.round(rect.h))
})

test('shrinking the only image on the board shrinks the board to fit it too, leaving no dead margin', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  await page.getByRole('button', { name: 'Plain' }).click()
  const rect = await pageRect(page)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2)
  const node = await selectionScreenRect(page)
  const seHandle = { x: node.x + node.w, y: node.y + node.h }

  // Shrink the image toward its own center - with nothing else on the
  // board, this used to leave the old, larger board size behind as dead
  // margin (the exact bug report fitBoardToContent closes: board.size stays
  // frozen once free-form editing starts, invariant 4 only protects frames).
  await page.mouse.move(seHandle.x, seHandle.y)
  await page.mouse.down()
  await page.mouse.move(node.x + node.w / 2, node.y + node.h / 2, { steps: 8 })
  await page.mouse.up()

  const rectAfter = await pageRect(page)
  expect(rectAfter.w).toBeLessThan(rect.w * 0.8)
  expect(rectAfter.h).toBeLessThan(rect.h * 0.8)
})
