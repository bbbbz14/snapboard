import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

async function pageRect(page: Page) {
  return page.locator('.board-page').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
}

function toolButton(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true })
}

function settingsButton(page: Page) {
  // Exact - `SelectionToolbar`'s own settings button ("Edit style") also
  // contains "Style" as a substring, and coexists with this one whenever a
  // one-shot tool's drawn shape is left selected (every tool here). Without
  // `exact`, Playwright's substring name matching resolves to both.
  return page.getByRole('button', { name: 'Style', exact: true })
}

/** Same "scan a region for the annotation red" technique `arrow.spec.ts`
 * already uses - the fixture images are gradients, not flat colors, so a
 * single exact-pixel read isn't reliable. */
function hasReddishPixel(page: Page, rect: { x: number; y: number; w: number; h: number }) {
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

/** Counts reddish pixels in a 1px-wide vertical strip - a rough proxy for a
 * horizontal stroke's thickness at that x, the same "scan a region, count
 * matches" technique `arrow.spec.ts`/`box.spec.ts` already use for "is a
 * red pixel here at all", just counting instead of a boolean. */
function verticalReddishRun(page: Page, x: number, yTop: number, yBottom: number) {
  return page.locator('canvas.board-canvas').evaluate(
    (el, r) => {
      const canvas = el as HTMLCanvasElement
      const bcr = canvas.getBoundingClientRect()
      const scale = canvas.width / bcr.width
      const ctx = canvas.getContext('2d')!
      const cx = Math.round((r.x - bcr.x) * scale)
      const y0 = Math.max(0, Math.round((r.yTop - bcr.y) * scale))
      const y1 = Math.min(canvas.height, Math.round((r.yBottom - bcr.y) * scale))
      const data = ctx.getImageData(cx, y0, 1, Math.max(1, y1 - y0)).data
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        const red = data[i]!
        const green = data[i + 1]!
        const blue = data[i + 2]!
        if (red > 150 && green < 100 && blue < 100) count++
      }
      return count
    },
    { x, yTop, yBottom },
  )
}

test('the settings button is disabled with no tool armed, and shows the armed tool color and default size once one is', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))

  await expect(settingsButton(page)).toBeDisabled()

  await toolButton(page, 'Arrow').click()
  await expect(settingsButton(page)).toBeEnabled()

  // The size slider is now inline in the toolbar itself, visible the instant
  // a sizable tool is armed - no popover click needed to reach it (real-usage
  // feedback: gating it behind the color popover meant most users never
  // discovered it existed at all).
  await expect(page.getByRole('slider', { name: 'Size' })).toHaveValue('4')

  await settingsButton(page).click()
  const popover = page.getByRole('dialog', { name: 'Style' })
  await expect(popover).toBeVisible()
  await expect(page.getByRole('button', { name: '#dc2626' })).toHaveAttribute('aria-pressed', 'true')
  // Straight is the arrow tool's own default (real-usage feedback: a curve
  // alone "looks unprofessional" for some uses) - curved is the opt-in.
  await expect(page.getByRole('button', { name: 'Straight' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Curved' })).toHaveAttribute('aria-pressed', 'false')
})

test('cancelling an armed tool with the color popover open does not leave it stuck open for the next time the same tool is armed', async ({
  page,
  images,
  addViaPicker,
}) => {
  // Regression test: unlike drawing a shape (which closes this popover
  // naturally via its own outside-click listener, since starting the
  // drag/click is itself a mousedown outside it), Escape cancels the armed
  // tool with no mousedown at all - without resetting `colorOpen` when
  // nothing is armed anymore, the popover would silently reopen, unprompted,
  // the next time the same tool is re-armed.
  await addViaPicker(page, images([[400, 300]]))

  await toolButton(page, 'Arrow').click()
  await settingsButton(page).click()
  await expect(page.getByRole('dialog', { name: 'Style' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(toolButton(page, 'Arrow')).toHaveAttribute('aria-pressed', 'false')
  await expect(settingsButton(page)).toBeDisabled()

  await toolButton(page, 'Arrow').click()
  await expect(settingsButton(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('dialog', { name: 'Style' })).toHaveCount(0)
})

test('the line-style toggle only appears for the arrow tool, and switches a newly drawn arrow between straight and curved', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Box').click()
  await settingsButton(page).click()
  await expect(page.getByRole('button', { name: 'Straight' })).toHaveCount(0)
  await settingsButton(page).click() // close

  await toolButton(page, 'Arrow').click()
  const y1 = rect.y + rect.h + 40
  const start1 = { x: rect.x + 20, y: y1 }
  const end1 = { x: rect.x + 160, y: y1 }
  await page.mouse.move(start1.x, start1.y)
  await page.mouse.down()
  await page.mouse.move(end1.x, end1.y, { steps: 8 })
  await page.mouse.up()
  // A straight arrow's stroke passes exactly through the midpoint of its own
  // start/end line - a curved one bows well clear of it (see arrow.ts's own
  // `bow` formula), so sampling that one point tells straight from curved
  // without needing to trace the curve's bezier math in the test.
  const mid1 = { x: (start1.x + end1.x) / 2, y: y1 }
  expect(await hasReddishPixel(page, { x: mid1.x - 2, y: mid1.y - 2, w: 4, h: 4 })).toBe(true)

  await toolButton(page, 'Arrow').click()
  await settingsButton(page).click()
  await page.getByRole('button', { name: 'Curved' }).click()
  await settingsButton(page).click() // close

  const y2 = y1 + 60
  const start2 = { x: rect.x + 20, y: y2 }
  const end2 = { x: rect.x + 160, y: y2 }
  await page.mouse.move(start2.x, start2.y)
  await page.mouse.down()
  await page.mouse.move(end2.x, end2.y, { steps: 8 })
  await page.mouse.up()
  const mid2 = { x: (start2.x + end2.x) / 2, y: y2 }
  expect(await hasReddishPixel(page, { x: mid2.x - 2, y: mid2.y - 2, w: 4, h: 4 })).toBe(false)
})

test('redact settings have no size slider, only color', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))

  await toolButton(page, 'Redact').click()
  // No inline slider at all for redact - it has no size dimension (see
  // RedactNode's own note), unlike every other sizable tool.
  await expect(page.getByRole('slider', { name: 'Size' })).toHaveCount(0)

  await settingsButton(page).click()
  const popover = page.getByRole('dialog', { name: 'Style' })
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('slider')).toHaveCount(0)
  await expect(popover.getByRole('button', { name: /^#/ })).toHaveCount(7)
})

test('picking a color in the settings popover changes the color of the next arrow drawn', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Arrow').click()
  await settingsButton(page).click()
  await page.getByRole('button', { name: '#16a34a' }).click()
  // Closing via the settings button again, not a canvas click - the board is
  // still the arrow tool's drag surface, so clicking it would start a draw.
  await settingsButton(page).click()

  const y = rect.y + rect.h + 40
  const start = { x: rect.x + 20, y }
  const end = { x: rect.x + 160, y }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  const region = { x: start.x - 10, y: y - 30, w: end.x - start.x + 20, h: 60 }
  const greenish = await page.locator('canvas.board-canvas').evaluate(
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
        if (green > 130 && red < 60 && blue < 100) return true
      }
      return false
    },
    region,
  )
  expect(greenish).toBe(true)
})

test('scrolling the mouse wheel while the box tool is armed changes its size, reflected live in the inline slider', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Box').click()
  // The size readout is inline in the toolbar, not gated behind opening the
  // color popover - see the note above.
  const value = page.locator('.annotation-settings__value')
  await expect(value).toHaveText('3px')

  await page.mouse.move(rect.x + rect.w / 2, rect.y + rect.h + 40)
  await page.mouse.wheel(0, -100)
  await expect(value).toHaveText('4px')
})

test('the size slider changes the stroke width of newly drawn boxes', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  const boxTool = toolButton(page, 'Box')
  await boxTool.click()

  const y1 = rect.y + rect.h + 60
  await page.mouse.move(rect.x + 20, y1)
  await page.mouse.down()
  await page.mouse.move(rect.x + 120, y1 + 40, { steps: 5 })
  await page.mouse.up()
  const thin = await verticalReddishRun(page, rect.x + 70, y1 - 10, y1 + 10)

  await boxTool.click()
  // The slider is inline in the toolbar, visible the instant the tool is
  // armed - no need to open the color popover to reach it (and doing so
  // anyway would race `useFocusTrap`'s own auto-focus against this slider's
  // manual `.focus()` call below, since the two now live in separate DOM
  // subtrees once size moved out of that popover).
  const slider = page.getByRole('slider', { name: 'Size' })
  await slider.focus()
  await page.keyboard.press('End')

  // Offset horizontally, not stacked further down - `AnnotationToolbar` (now
  // wider, with undo/redo, the line tool, and the inline size slider all
  // added since this test was first written) sits bottom-left and reaches
  // far enough right that a second row at `y1 + 80` lands its drag right on
  // top of the toolbar, not the canvas - the same "second box" collision
  // `annotationEdit.spec.ts`'s color-edit test already avoids for the exact
  // same reason.
  const x2 = rect.x + 260
  await page.mouse.move(x2, y1)
  await page.mouse.down()
  await page.mouse.move(x2 + 100, y1 + 40, { steps: 5 })
  await page.mouse.up()
  const thick = await verticalReddishRun(page, x2 + 50, y1 - 10, y1 + 10)

  expect(thick).toBeGreaterThan(thin)
})
