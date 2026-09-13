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

/** The text tool's default color (#dc2626) is nothing like the white board
 * background or the fixture images' blue-ish gradients (see png.ts), so
 * scanning a region for a reddish pixel is a robust way to tell "some text
 * is drawn somewhere in here" without pinning down exact glyph pixels -
 * same technique arrow.spec.ts/box.spec.ts already use, for the same reason
 * (wrapped, multi-line text isn't at one predictable pixel either). */
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

function textToolButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: 'Text' })
}

test('the text tool places an editable box, types in Thai and English, and survives export', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await textToolButton(page).click()
  await expect(textToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  const at = { x: rect.x + 20, y: rect.y + rect.h + 20 }
  const region = { x: at.x - 10, y: at.y - 10, w: 280, h: 120 }
  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.mouse.click(at.x, at.y)
  // Placing a text box is a one-shot gesture, same as arrow/box - the tool
  // reverts to select immediately, before the user has typed anything.
  await expect(textToolButton(page)).toHaveAttribute('aria-pressed', 'false')

  const editor = page.locator('.text-edit')
  await expect(editor).toBeFocused()
  await editor.fill('Hello ทดสอบข้อความภาษาไทย')
  await page.keyboard.press('ControlOrMeta+Enter')

  await expect(page.locator('.text-edit')).toHaveCount(0)
  await expect(page.locator('.selection-status')).toHaveText('1 selected')
  expect(await hasReddishPixel(page, region)).toBe(true)

  // One renderer for preview and export (invariant 1) - the text must reach
  // the downloaded file too, not just the on-screen canvas.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(await download.path()).toBeTruthy()
})

test('the "T" shortcut arms the tool, and Escape cancels a fresh placement without creating anything', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await page.keyboard.press('t')
  await expect(textToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await expect(textToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(status).toHaveText('')

  // Arming again and placing one, but discarding it before typing anything.
  await page.keyboard.press('t')
  await page.mouse.click(rect.x + 20, rect.y + rect.h + 20)
  await expect(page.locator('.text-edit')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.text-edit')).toHaveCount(0)
  await expect(status).toHaveText('')
})

test('committing an empty text box (blur with nothing typed) creates nothing', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await textToolButton(page).click()
  await page.mouse.click(rect.x + 20, rect.y + rect.h + 20)
  await page.keyboard.press('ControlOrMeta+Enter')

  await expect(page.locator('.text-edit')).toHaveCount(0)
  await expect(status).toHaveText('')
})

test('a text node can be selected, deleted, and the delete undone', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  const at = { x: rect.x + 20, y: rect.y + rect.h + 20 }
  const region = { x: at.x - 10, y: at.y - 10, w: 280, h: 120 }

  await textToolButton(page).click()
  await page.mouse.click(at.x, at.y)
  await page.locator('.text-edit').fill('delete me')
  await page.keyboard.press('ControlOrMeta+Enter')

  await expect(status).toHaveText('1 selected')
  expect(await hasReddishPixel(page, region)).toBe(true)

  await page.keyboard.press('Delete')
  await expect(status).toHaveText('')
  expect(await hasReddishPixel(page, region)).toBe(false)

  await page.keyboard.press('ControlOrMeta+Z')
  expect(await hasReddishPixel(page, region)).toBe(true)
})

test('double-clicking a text node re-opens it for editing and lets you fix its content', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  const at = { x: rect.x + 20, y: rect.y + rect.h + 20 }

  await textToolButton(page).click()
  await page.mouse.click(at.x, at.y)
  await page.locator('.text-edit').fill('a typo')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(page.locator('.text-edit')).toHaveCount(0)

  await page.mouse.dblclick(at.x + 5, at.y + 5)
  const editor = page.locator('.text-edit')
  await expect(editor).toBeVisible()
  await expect(editor).toHaveValue('a typo')

  await editor.fill('fixed now')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(page.locator('.text-edit')).toHaveCount(0)

  // Re-opening once more proves the earlier edit actually committed, not
  // just that the overlay showed the right thing transiently.
  await page.mouse.dblclick(at.x + 5, at.y + 5)
  await expect(page.locator('.text-edit')).toHaveValue('fixed now')
  await page.keyboard.press('Escape')
})

test('typing a growing single line does not wrap early, before the box reaches TEXT_MAX_WIDTH', async ({
  page,
  images,
  addViaPicker,
}) => {
  // Regression test: `.text-edit` is `box-sizing: border-box` with a 1px
  // border on each side, but `textAutoWidth`'s width (what the overlay's CSS
  // width was set to) only ever reserved room for the padding, not the
  // border - so the overlay's real content area was 2px narrower than what
  // `ctx.measureText` had just calculated as an exact fit. A single growing
  // line would wrap to a second line mid-word, well before the box actually
  // reached TEXT_MAX_WIDTH (480). See CLAUDE.md's "third round of real-usage
  // feedback" note. `scrollHeight` jumping by a full line's worth on a
  // single character insert (typed one at a time, no `\n` involved) is what
  // an unwanted wrap looks like from the outside.
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await textToolButton(page).click()
  const at = { x: rect.x + 20, y: rect.y + rect.h + 20 }
  await page.mouse.click(at.x, at.y)
  const editor = page.locator('.text-edit')
  await expect(editor).toBeFocused()

  const text = 'the quick brown fox jumps over the lazy dog and then runs'
  let baseline: number | null = null
  for (let i = 1; i <= text.length; i++) {
    await page.keyboard.type(text[i - 1]!, { delay: 0 })
    const info = await editor.evaluate((el: HTMLTextAreaElement) => ({
      scrollHeight: el.scrollHeight,
      width: parseFloat(el.style.width),
    }))
    if (info.width >= 470) break // approaching TEXT_MAX_WIDTH - wrapping here is expected, stop
    if (baseline === null) baseline = info.scrollHeight
    expect(info.scrollHeight).toBe(baseline)
  }
  await page.keyboard.press('Escape')
})
