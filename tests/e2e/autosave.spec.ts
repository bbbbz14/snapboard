import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

/** `page.waitForFunction` does not reliably await an in-page Promise-returning
 * predicate - it can treat the (always-truthy) Promise object itself as the
 * poll result before it resolves. Polling from the Node side with
 * `expect.poll` + `page.evaluate` round-trips per attempt and actually waits
 * for the resolved value, which is what proves the 800ms debounce in
 * src/board/persist/autosave.ts really landed. */
async function autosavedNodeCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('snapboard')
        req.onerror = () => resolve(-1)
        req.onsuccess = () => {
          const getReq = req.result.transaction('board', 'readonly').objectStore('board').get('current')
          getReq.onsuccess = () => resolve(getReq.result?.nodes?.length ?? 0)
          getReq.onerror = () => resolve(-1)
        }
      }),
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('reloading the tab recovers the board and shows a dismissible bar', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Grid' }).click()
  await expect.poll(() => autosavedNodeCount(page)).toBe(2)

  await page.reload()

  await expect(page.getByText('Recovered your last board')).toBeVisible()
  await expect(page.locator('.board-page')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByText('Recovered your last board')).toHaveCount(0)
  await expect(page.locator('.board-page')).toBeVisible()
})

test('Start fresh clears the board and the empty state survives a reload', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  await expect.poll(() => autosavedNodeCount(page)).toBe(1)

  await page.reload()
  await expect(page.getByText('Recovered your last board')).toBeVisible()

  await page.getByRole('button', { name: 'Start fresh' }).click()
  await expect(page.getByText('Recovered your last board')).toHaveCount(0)
  await expect(page.getByText('Paste a screenshot')).toBeVisible()
  await expect.poll(() => autosavedNodeCount(page)).toBe(0)

  await page.reload()
  await expect(page.getByText('Recovered your last board')).toHaveCount(0)
  await expect(page.getByText('Paste a screenshot')).toBeVisible()
})
