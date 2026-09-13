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

/** Bounding box of the selection outline on `.board-interaction`, in page
 * coordinates - same technique as moveResize.spec.ts, so a test can find a
 * node's exact on-screen rect without assuming layout math. */
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

function boardLabel(page: import('@playwright/test').Page) {
  return page.locator('canvas.board-canvas').getAttribute('aria-label')
}

test('Delete key removes the selected node and clears the selection', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await expect.poll(() => boardLabel(page)).toBe('Board with 2 images')

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  await expect(status).toHaveText('1 selected')

  await page.keyboard.press('Delete')

  await expect.poll(() => boardLabel(page)).toBe('Board with 1 image')
  await expect(status).toHaveText('')
})

test('the duplicate button copies the selected node and selects the copy', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2)
  await expect(status).toHaveText('1 selected')

  await page.getByRole('button', { name: 'Duplicate' }).click()

  await expect.poll(() => boardLabel(page)).toBe('Board with 2 images')
  // The copy, not the original, is left selected.
  await expect(status).toHaveText('1 selected')
})

test('bring to front puts the selected node above an overlapping one', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Plain' }).click()
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  // Measure both nodes' exact on-screen rects via their selection outlines.
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  const topRect = await selectionScreenRect(page)
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.75)
  const bottomRect = await selectionScreenRect(page)

  const topCenter = { x: topRect.x + topRect.w / 2, y: topRect.y + topRect.h / 2 }
  const bottomCenter = { x: bottomRect.x + bottomRect.w / 2, y: bottomRect.y + bottomRect.h / 2 }
  // Both nodes span the board's full content width in "Stacked" mode (see
  // the measured rects above), so there's no room to shift sideways without
  // sliding off the page - overlap has to come from the vertical axis
  // instead. Drag the top node down so it partly overlaps the bottom node,
  // but land its center just outside the bottom node's frame - that's what
  // makes this a free-form move (invariant 4's escape hatch) rather than a
  // swap via drag-to-reorder (item 5), which would leave them non-overlapping.
  const h = bottomRect.h
  const target = { x: bottomCenter.x, y: bottomCenter.y - h * 0.55 }

  await page.mouse.move(topCenter.x, topCenter.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 8 })
  await page.mouse.up()

  // The move just vacated the board's old top edge, so it may have shrunk
  // and refit the board (see boardStore.ts's fitBoardToContent) - every
  // screen pixel from here on can differ from what topRect/bottomRect/
  // bottomCenter measured pre-move. Re-measure both nodes fresh instead of
  // reusing those. A drag leaves the dragged node selected, so its outline
  // is available immediately.
  const movedRect = await selectionScreenRect(page)
  const rect2 = await pageRect(page)
  // `.board-page` (rect2) spans the whole board including its `padding`
  // gutter, not just the image content - 90% down is comfortably inside the
  // bottom node's actual pixels regardless of how much the gutter itself
  // just rescaled, the same fraction-of-rect style topRect/bottomRect above
  // already used rather than an absolute offset from the edge.
  await page.mouse.click(rect2.x + rect2.w / 2, rect2.y + rect2.h * 0.9)
  const bottomRect2 = await selectionScreenRect(page)

  // The fixture images are gradients, not flat colors (see png.ts), so a
  // point can't be checked against a precomputed "this node's color" - only
  // against itself before and after, the same way moveResize.spec.ts proves
  // a drag happened. The stationary (bottom-slot) node was added second, so
  // it already paints on top of the moved one at the overlap.
  const onlyMoved = { x: movedRect.x + movedRect.w / 2, y: movedRect.y + 5 }
  const overlap = { x: bottomRect2.x + bottomRect2.w / 2, y: bottomRect2.y + 5 }
  const overlapBefore = await pixelAt(page, overlap.x, overlap.y)

  // Select the moved node specifically, using the part only it covers.
  await page.mouse.click(onlyMoved.x, onlyMoved.y)
  await expect(status).toHaveText('1 selected')

  await page.getByRole('button', { name: 'Bring to front' }).click()

  const overlapAfter = await pixelAt(page, overlap.x, overlap.y)
  const diff = Math.abs(overlapAfter[0]! - overlapBefore[0]!) + Math.abs(overlapAfter[1]! - overlapBefore[1]!) + Math.abs(overlapAfter[2]! - overlapBefore[2]!)
  expect(diff).toBeGreaterThan(20)
})
