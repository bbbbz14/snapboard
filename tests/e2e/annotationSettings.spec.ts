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
  return page.getByRole('button', { name: 'Style' })
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

  await settingsButton(page).click()
  const popover = page.getByRole('dialog', { name: 'Style' })
  await expect(popover).toBeVisible()
  await expect(page.getByRole('button', { name: '#dc2626' })).toHaveAttribute('aria-pressed', 'true')
  await expect(popover.locator('.annotation-settings__value')).toHaveText('4px')
})

test('redact settings have no size slider, only color', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))

  await toolButton(page, 'Redact').click()
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

test('scrolling the mouse wheel while the box tool is armed changes its size, reflected live in the popover', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Box').click()
  await settingsButton(page).click()
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
  await settingsButton(page).click()
  const slider = page.getByRole('slider', { name: 'Size' })
  await slider.focus()
  await page.keyboard.press('End')
  await settingsButton(page).click()

  const y2 = y1 + 80
  await page.mouse.move(rect.x + 20, y2)
  await page.mouse.down()
  await page.mouse.move(rect.x + 120, y2 + 40, { steps: 5 })
  await page.mouse.up()
  const thick = await verticalReddishRun(page, rect.x + 70, y2 - 10, y2 + 10)

  expect(thick).toBeGreaterThan(thin)
})
