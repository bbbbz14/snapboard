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

test('dragging a node onto another reorders them without leaving the auto layout', async ({
  page,
  images,
  addViaPicker,
  browserName,
}) => {
  // The store/layout assertions below are reliable everywhere, but the pixel
  // swap this test relies on to prove the reorder happened is not: headless
  // WebKit's canvas rasterization can lag by an unbounded amount specifically
  // when two same-size cached tiles swap position in one redraw (confirmed
  // by direct tile/store inspection - the committed data and even a forced
  // `getImageData` flush are correct; only this preview repaint is affected).
  // See the WebKit rasterization gotcha in CLAUDE.md. Not reproduced on
  // Chromium or Firefox, and real Safari is unconfirmed either way.
  test.skip(browserName === 'webkit', 'Headless WebKit can leave stale pixels after a same-size tile swap - see CLAUDE.md')
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Steps' }).click()
  const rect = await pageRect(page)
  const top = { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.25 }
  const bottom = { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.75 }

  const topBefore = await pixelAt(page, top.x, top.y)
  const bottomBefore = await pixelAt(page, bottom.x, bottom.y)

  // Drag the top (step 1) node down onto the bottom (step 2) node.
  await page.mouse.move(top.x, top.y)
  await page.mouse.down()
  await page.mouse.move(bottom.x, bottom.y, { steps: 8 })
  await page.mouse.up()

  // Still auto-arranged: the layout chips are showing, not the free-layout
  // banner, and the two nodes swapped back to their original slots (auto
  // layout, unlike a free move, snaps back to its own computed frames).
  await expect(page.getByRole('button', { name: 'Steps' })).toBeVisible()
  await expect(page.getByText('Auto layout off')).toHaveCount(0)

  const changed = (a: number[], b: number[]) => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!) > 20

  // Both slots now show different content - a reorder happened, not a
  // free-form move that left them where they were. `reorder` commits
  // through the store, so the target node's own frame only updates once
  // React re-renders BoardCanvas with the new board prop - poll instead of
  // reading a single synchronous snapshot right after mouse.up().
  await expect.poll(async () => changed(topBefore, await pixelAt(page, top.x, top.y))).toBe(true)
  await expect.poll(async () => changed(bottomBefore, await pixelAt(page, bottom.x, bottom.y))).toBe(true)
})
