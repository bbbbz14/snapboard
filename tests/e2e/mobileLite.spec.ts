import { test, expect } from './fixtures'

/**
 * Phase 5 item 11 - mobile lite mode. Product plan §4.6: below a narrow
 * viewport the app shows "เลือกรูป -> เลือกโหมดจัดวาง -> บันทึกภาพ" (pick
 * images -> pick a layout mode -> save) with no free move/resize/annotate on
 * the canvas - see `useIsMobile`'s own comment for why 700px is the
 * breakpoint and `BoardCanvas`'s `interactive` prop for what it turns off.
 */
test.use({ viewport: { width: 390, height: 844 } })

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
 * same technique as `moveResize.spec.ts`'s own `pixelAt` (converts to the
 * canvas's own backing-store pixel coordinates, since `getImageData` needs
 * canvas-local px, not page px). */
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

test('narrow viewport hides per-node/canvas-interaction chrome but keeps the layout/style/background/export controls', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))

  // None of these ever get a reason to mount when `interactive={false}` -
  // there is no armed tool, no selection, no zoom gesture to control.
  await expect(page.locator('.zoom-controls')).toHaveCount(0)
  await expect(page.locator('.annotation-toolbar')).toHaveCount(0)
  await expect(page.locator('.selection-toolbar')).toHaveCount(0)

  // The actual lite-mode flow - choose a layout mode, style, background - is
  // untouched, same TopBar as desktop.
  await expect(page.getByRole('button', { name: 'Rows' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stacked' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Grid' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Card' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Background' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible()

  await expect(page.getByRole('img', { name: /Board with 2 images/ })).toBeVisible()
})

test('clicking or dragging the board never selects or moves a node', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const status = page.locator('.selection-status')
  const rect = await pageRect(page)

  // Same click that `selection.spec.ts` proves selects a node at desktop
  // width - here it must do nothing at all.
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  await expect(status).toHaveText('')

  // A full drag gesture (the desktop move path) must also be a no-op - not
  // just a plain click. Sample the same screen point before and after (the
  // fixture images are gradients, not flat colors - see the item 6 e2e
  // gotcha in CLAUDE.md) to prove the pixel really didn't move.
  const point = { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.25 }
  const before = await pixelAt(page, point.x, point.y)

  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x + 60, point.y + 60, { steps: 5 })
  await page.mouse.up()
  await expect(status).toHaveText('')

  const after = await pixelAt(page, point.x, point.y)
  expect(after).toEqual(before)
})

test('the full lite flow - pick images, pick a layout mode, save - produces a real file', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300], [300, 400], [500, 200]]))
  await page.getByRole('button', { name: 'Grid' }).click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  const path = await download.path()
  expect(path).toBeTruthy()
})
