import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

/** Same IndexedDB-polling technique as autosave.spec.ts - `page.waitForFunction`
 * does not reliably await an in-page Promise, so poll from the Node side. */
async function lastClearedNodeCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('snapboard')
        req.onerror = () => resolve(-1)
        req.onsuccess = () => {
          const getReq = req.result.transaction('lastCleared', 'readonly').objectStore('lastCleared').get('snapshot')
          getReq.onsuccess = () => resolve(getReq.result?.board?.nodes?.length ?? 0)
          getReq.onerror = () => resolve(-1)
        }
      }),
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('Clear board asks for confirmation, then offers to restore what it just cleared', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))

  await page.getByRole('button', { name: 'Clear board' }).click() // dialog auto-accepted by the fixture
  await expect(page.getByText('Paste a screenshot')).toBeVisible()
  await expect(page.getByText('Board cleared')).toBeVisible()

  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Board cleared')).toHaveCount(0)
  await expect(page.locator('.board-page')).toBeVisible()
})

test('restoring a cleared board can still be undone, same as any other commit', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  await page.getByRole('button', { name: 'Clear board' }).click()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.locator('.board-page')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+Z')
  await expect(page.getByText('Paste a screenshot')).toBeVisible()
})

test('the safety net survives a reload, not just the current session', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  await page.getByRole('button', { name: 'Clear board' }).click()
  await expect.poll(() => lastClearedNodeCount(page)).toBe(1)

  await page.reload()

  await expect(page.getByText('Board cleared')).toBeVisible()
  await expect(page.getByText('Paste a screenshot')).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.locator('.board-page')).toBeVisible()
})

test('dismissing the bar hides it for good, including across a reload', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  await page.getByRole('button', { name: 'Clear board' }).click()
  await expect(page.getByText('Board cleared')).toBeVisible()

  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText('Board cleared')).toHaveCount(0)
  await expect.poll(() => lastClearedNodeCount(page)).toBe(0)

  await page.reload()
  await expect(page.getByText('Board cleared')).toHaveCount(0)
})
