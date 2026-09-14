import { test, expect } from './fixtures'

/**
 * Phase 5 item 11 - mobile lite mode, revised by real-usage feedback.
 * Product plan §4.6 still rules out free move/resize/crop of *images* on a
 * narrow viewport ("การลาก-ย่อ-ขยายบนจอเล็กคือ UX ที่แย่เสมอ") and there is
 * still no pinch/wheel zoom - see `useIsMobile`'s own comment for why 700px
 * is the breakpoint and `BoardCanvas`'s `interactive` prop for what stays
 * off. What changed: a user testing the live site found the top bar's own
 * horizontal-scroll fallback (item 3) unpleasant with Background/Layout/
 * Style/Gap all inline, and asked to actually use the annotation tools
 * (Arrow/Box/Text/Number/Redact) on a phone, not just pick a layout and
 * save. `TopBar` now folds those four controls into one popover
 * (`MobileSettingsMenu`) instead of showing them inline, and `BoardCanvas`'s
 * new `annotate` prop turns tool placement and per-annotation select/
 * duplicate/delete/restyle back on without reintroducing free image editing
 * - see both components' own comments for the exact split.
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

/** Same reddish-pixel-region scan `arrow.spec.ts` established - the default
 * annotation red (#dc2626) has nothing in common with the white board
 * background or the fixture images' blue-ish gradients. */
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

function settingsButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Layout, style & background' })
}

test('the top bar never needs horizontal scrolling, and Background/Layout/Style/Gap live behind one settings icon', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))

  // The whole point of folding these four controls into a popover - see
  // this file's own header comment. `scrollWidth > clientWidth` is exactly
  // what item 3's `overflow-x: auto` fallback depends on to kick in, so
  // this is a direct measurement of "does the bar still need it", not a
  // proxy for it.
  const overflowing = await page.locator('.topbar').evaluate((el) => el.scrollWidth > el.clientWidth + 1)
  expect(overflowing).toBe(false)

  // Not shown inline anymore - only reachable via the settings popover.
  // (`{ exact: true }` matters here: Playwright's default name match is a
  // case-insensitive substring, and the settings button's own accessible
  // name, "Layout, style & background", would otherwise satisfy a bare
  // `name: 'Background'` query too - the same substring gotcha
  // annotationSettings.spec.ts already hit once, see CLAUDE.md.)
  await expect(page.getByRole('button', { name: 'Rows' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Background', exact: true })).toHaveCount(0)

  await settingsButton(page).click()
  await expect(page.getByRole('button', { name: 'Rows' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stacked' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Grid' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Card' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Transparent' })).toBeVisible()
  await expect(page.getByLabel('Gap')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Rows' })).toHaveCount(0)

  // Download/Copy were never folded in - always one tap away, same as desktop.
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible()

  await expect(page.getByRole('img', { name: /Board with 2 images/ })).toBeVisible()
})

test('the annotation and selection toolbars mount, but zoom/crop controls still do not', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))

  // Placing/editing annotations is back (this file's own header comment) -
  // AnnotationToolbar/SelectionToolbar mount unconditionally once there's a
  // board to annotate, the same as at desktop width. Pan/zoom and per-image
  // crop are a different, still-excluded capability (product plan §4.6).
  await expect(page.locator('.annotation-toolbar')).toHaveCount(1)
  await expect(page.locator('.selection-toolbar')).toHaveCount(1)
  await expect(page.locator('.zoom-controls')).toHaveCount(0)
})

test('clicking or dragging an image never selects or moves it', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await settingsButton(page).click()
  await page.getByRole('button', { name: 'Stacked' }).click()
  await page.keyboard.press('Escape')
  const status = page.locator('.selection-status')
  const rect = await pageRect(page)

  // Same click that `selection.spec.ts` proves selects a node at desktop
  // width - here, on an image, it must still do nothing at all.
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

test('the arrow tool can be armed and drawn on a narrow viewport, and the result can be selected and deleted', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')
  const arrowBtn = page.getByRole('button', { name: 'Arrow' })

  await arrowBtn.click()
  await expect(arrowBtn).toHaveAttribute('aria-pressed', 'true')

  const y = rect.y + rect.h + 40
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y }
  const region = { x: start.x - 10, y: y - 30, w: end.x - start.x + 20, h: 60 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // One-shot, same as desktop - drawing one arrow reverts to 'select' and
  // leaves the new node selected.
  await expect(arrowBtn).toHaveAttribute('aria-pressed', 'false')
  await expect(status).toHaveText('1 selected')
  expect(await hasReddishPixel(page, region)).toBe(true)

  // Deleting/restoring an already-placed annotation - the part that isn't
  // just "place it" - goes through the same SelectionToolbar/Delete-key path
  // as desktop, unlike an image (previous test), which never gets this far.
  await page.keyboard.press('Delete')
  await expect(status).toHaveText('')
  expect(await hasReddishPixel(page, region)).toBe(false)
})

test('the full lite flow - pick images, pick a layout mode, save - produces a real file', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300], [300, 400], [500, 200]]))
  await settingsButton(page).click()
  await page.getByRole('button', { name: 'Grid' }).click()
  await page.keyboard.press('Escape')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  const path = await download.path()
  expect(path).toBeTruthy()
})
