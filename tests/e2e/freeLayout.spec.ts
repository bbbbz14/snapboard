import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the first manual drag switches to free layout and shows the banner', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()

  const rect = await page.locator('.board-page').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const topCenter = { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.25 }

  await page.mouse.move(topCenter.x, topCenter.y)
  await page.mouse.down()
  await page.mouse.move(topCenter.x + 20, topCenter.y + 20, { steps: 5 })
  await page.mouse.up()

  // The layout chips (including the one just used) disappear, replaced by
  // the free-layout notice - relayout() now refuses to touch the board.
  await expect(page.getByText('Auto layout off')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stacked' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Turn back on' }).click()
  await expect(page.getByText('Auto layout off')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Auto' })).toBeVisible()
})
