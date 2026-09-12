import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

function boardLabel(page: import('@playwright/test').Page) {
  return page.locator('canvas.board-canvas').getAttribute('aria-label')
}

async function pageRect(page: import('@playwright/test').Page) {
  return page.locator('.board-page').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
}

/** Same technique as selectionActions.spec.ts: find a node's exact on-screen
 * rect from its selection outline on `.board-interaction`, rather than
 * assuming layout math. */
function selectionScreenRect(page: import('@playwright/test').Page) {
  return page.locator('.board-interaction').evaluate((el) => {
    const canvas = el as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.width / rect.width
    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        if (data[i + 3]! > 0 && data[i + 2]! > data[i]! && data[i + 2]! > 80) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    return { x: rect.x + minX / scale, y: rect.y + minY / scale, w: (maxX - minX) / scale, h: (maxY - minY) / scale }
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

test('Ctrl/Cmd+Shift+C copies the same way the Copy button does', async ({
  page,
  images,
  addViaPicker,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Headless Firefox and WebKit have no OS clipboard - see ADR-003')
  await addViaPicker(page, images([[900, 600]]))

  await page.keyboard.press('Control+Shift+c')
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()

  const bytes = await page.evaluate(async () => {
    const items = await navigator.clipboard.read()
    const item = items.find((i) => i.types.includes('image/png'))
    if (!item) return null
    const blob = await item.getType('image/png')
    return blob.size
  })
  expect(bytes).not.toBeNull()
  expect(bytes!).toBeGreaterThan(1000)
})

test('D duplicates the selected node, same as the toolbar button', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2)
  await expect(status).toHaveText('1 selected')

  await page.keyboard.press('d')

  await expect.poll(() => boardLabel(page)).toBe('Board with 2 images')
  // The copy, not the original, is left selected - same as the button (see
  // selectionActions.spec.ts's equivalent assertion).
  await expect(status).toHaveText('1 selected')
})

test('D does nothing without a selection', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  await expect.poll(() => boardLabel(page)).toBe('Board with 1 image')

  await page.keyboard.press('d')

  await expect.poll(() => boardLabel(page)).toBe('Board with 1 image')
})

test('F brings the selected node to front, same as the toolbar button', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300], [400, 300]]))
  await page.getByRole('button', { name: 'Plain' }).click()
  await page.getByRole('button', { name: 'Stacked' }).click()
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.25)
  const topRect = await selectionScreenRect(page)
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h * 0.75)
  const bottomRect = await selectionScreenRect(page)

  const topCenter = { x: topRect.x + topRect.w / 2, y: topRect.y + topRect.h / 2 }
  const bottomCenter = { x: bottomRect.x + bottomRect.w / 2, y: bottomRect.y + bottomRect.h / 2 }
  // Same vertical-overlap setup as selectionActions.spec.ts's mouse-driven
  // version of this test - both nodes span the board's full content width in
  // "Stacked" mode, so there's no room to overlap sideways.
  const h = bottomRect.h
  const target = { x: bottomCenter.x, y: bottomCenter.y - h * 0.55 }

  await page.mouse.move(topCenter.x, topCenter.y)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 8 })
  await page.mouse.up()

  const onlyMoved = { x: bottomCenter.x, y: bottomCenter.y - h * 0.775 }
  const overlap = { x: bottomCenter.x, y: bottomCenter.y - h * 0.275 }
  const overlapBefore = await pixelAt(page, overlap.x, overlap.y)

  await page.mouse.click(onlyMoved.x, onlyMoved.y)
  await expect(status).toHaveText('1 selected')

  await page.keyboard.press('f')

  const overlapAfter = await pixelAt(page, overlap.x, overlap.y)
  const diff =
    Math.abs(overlapAfter[0]! - overlapBefore[0]!) +
    Math.abs(overlapAfter[1]! - overlapBefore[1]!) +
    Math.abs(overlapAfter[2]! - overlapBefore[2]!)
  expect(diff).toBeGreaterThan(20)
})
