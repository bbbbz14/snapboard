import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

/** Board-space rect of the page in screen px, plus fractional helpers to click
 * reliably inside the top or bottom image of a two-up "Stacked" layout
 * without depending on exact per-node geometry. */
async function pageRect(page: import('@playwright/test').Page) {
  return page.locator('.board-page').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
}

test('click selects a single node, and clicking empty space deselects', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const status = page.locator('.selection-status')
  const rect = await pageRect(page)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  await expect(status).toHaveText('1 selected')

  // The padding around the stacked images is guaranteed empty.
  await page.mouse.click(rect.x + 3, rect.y + 3)
  await expect(status).toHaveText('')
})

test('shift-click adds to and removes from the selection', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const status = page.locator('.selection-status')
  const rect = await pageRect(page)
  const top = { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.25 }
  const bottom = { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.75 }

  await page.mouse.click(top.x, top.y)
  await expect(status).toHaveText('1 selected')

  await page.keyboard.down('Shift')
  await page.mouse.click(bottom.x, bottom.y)
  await expect(status).toHaveText('2 selected')

  await page.mouse.click(top.x, top.y)
  await expect(status).toHaveText('1 selected')
  await page.keyboard.up('Shift')
})

test('dragging from empty space marquee-selects everything it crosses', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const status = page.locator('.selection-status')
  const rect = await pageRect(page)

  await page.mouse.move(rect.x + 3, rect.y + 3)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.w - 3, rect.y + rect.h - 3, { steps: 5 })
  await page.mouse.up()
  await expect(status).toHaveText('2 selected')
})

test('Escape clears the selection', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const status = page.locator('.selection-status')
  const rect = await pageRect(page)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2)
  await expect(status).toHaveText('1 selected')

  await page.keyboard.press('Escape')
  await expect(status).toHaveText('')
})
