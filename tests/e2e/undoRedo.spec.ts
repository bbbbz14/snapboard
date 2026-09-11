import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

function boardLabel(page: import('@playwright/test').Page) {
  return page.locator('canvas.board-canvas').getAttribute('aria-label')
}

async function pageRect(page: import('@playwright/test').Page) {
  return page.locator('.board-page').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
}

/** Samples a pixel straight off the live canvas backing store, converting
 * page-space to device pixels - same technique moveResize.spec.ts and
 * selectionActions.spec.ts use to prove a canvas actually redrew. */
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

test('Ctrl/Cmd+Z undoes a layout change, Shift+Ctrl/Cmd+Z redoes it', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await expect.poll(() => boardLabel(page)).toBe('Board with 2 images')

  await page.getByRole('button', { name: 'Stacked' }).click()
  await expect(page.getByRole('button', { name: 'Stacked' })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Control+z')
  await expect(page.getByRole('button', { name: 'Stacked' })).toHaveAttribute('aria-pressed', 'false')

  await page.keyboard.press('Control+Shift+z')
  await expect(page.getByRole('button', { name: 'Stacked' })).toHaveAttribute('aria-pressed', 'true')
})

test('a new action after undo discards the redo branch', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  await page.getByRole('button', { name: 'Card' }).click()
  await page.getByRole('button', { name: 'Soft' }).click()
  await expect(page.getByRole('button', { name: 'Soft' })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Control+z')
  await expect(page.getByRole('button', { name: 'Card' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Plain' }).click()
  await expect(page.getByRole('button', { name: 'Plain' })).toHaveAttribute('aria-pressed', 'true')

  // The "Soft" step was discarded by the intervening "Plain" click, so redo
  // has nothing left to reach it with.
  await page.keyboard.press('Control+Shift+z')
  await expect(page.getByRole('button', { name: 'Plain' })).toHaveAttribute('aria-pressed', 'true')
})

test('undoing a delete brings back a real, still-decoded image, not a broken one', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await pageRect(page)

  await expect.poll(() => boardLabel(page)).toBe('Board with 2 images')
  const before = await pixelAt(page, rect.x + rect.w / 2, rect.y + rect.h * 0.25)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  await page.keyboard.press('Delete')
  await expect.poll(() => boardLabel(page)).toBe('Board with 1 image')

  await page.keyboard.press('Control+z')
  await expect.poll(() => boardLabel(page)).toBe('Board with 2 images')

  // Regression guard: AssetStore used to free an image's ImageBitmap the
  // moment its refcount hit zero on delete, which made undo unable to bring
  // it back (see boardStore's reconcileAssets - refs now also account for
  // what undo/redo history still reaches). If that ever regresses, the
  // restored node renders as empty/transparent instead of the same pixels.
  const after = await pixelAt(page, rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  expect(after).toEqual(before)
})

test('dragging the gap slider is one undo step, not one per tick', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  const slider = page.getByLabel('Gap')
  const before = await slider.inputValue()

  const box = (await slider.boundingBox())!
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()

  const afterDrag = await slider.inputValue()
  expect(afterDrag).not.toBe(before)

  // One undo reverts the whole drag, in one step, back to the value from
  // before the gesture started - not one step per tick (see
  // beginAdjustment/endAdjustment in boardStore.ts). A second undo would go
  // past this and undo the earlier addViaPicker step too, so it isn't a
  // useful assertion here.
  await page.keyboard.press('Control+z')
  await expect(slider).toHaveValue(before)
})
