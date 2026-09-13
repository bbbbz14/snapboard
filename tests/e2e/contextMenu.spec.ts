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

function boardLabel(page: import('@playwright/test').Page) {
  return page.locator('canvas.board-canvas').getAttribute('aria-label')
}

test('right-clicking a node selects it and opens a menu with the selection actions', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2, { button: 'right' })

  await expect(status).toHaveText('1 selected')
  const menu = page.getByRole('menu', { name: 'Selection actions' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Crop' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Duplicate/ })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Bring to front/ })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
})

test('right-clicking empty space opens no menu', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  await page.mouse.click(20, 20, { button: 'right' })
  await expect(page.getByRole('menu', { name: 'Selection actions' })).not.toBeVisible()
})

test('Duplicate in the context menu duplicates the node, same as the toolbar button', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2, { button: 'right' })
  const menu = page.getByRole('menu', { name: 'Selection actions' })
  await menu.getByRole('menuitem', { name: /Duplicate/ }).click()

  await expect.poll(() => boardLabel(page)).toBe('Board with 2 images')
  await expect(menu).not.toBeVisible()
})

test('Delete in the context menu removes the node', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await pageRect(page)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25, { button: 'right' })
  const menu = page.getByRole('menu', { name: 'Selection actions' })
  await menu.getByRole('menuitem', { name: 'Delete' }).click()

  await expect.poll(() => boardLabel(page)).toBe('Board with 1 image')
})

test('Escape closes the context menu', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2, { button: 'right' })
  const menu = page.getByRole('menu', { name: 'Selection actions' })
  await expect(menu).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
})

test('Crop is hidden from the menu when more than one node is selected', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await pageRect(page)

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  await page.keyboard.down('Shift')
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.75)
  await page.keyboard.up('Shift')
  await expect(page.locator('.selection-status')).toHaveText('2 selected')

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25, { button: 'right' })
  const menu = page.getByRole('menu', { name: 'Selection actions' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Crop' })).toHaveCount(0)
})
