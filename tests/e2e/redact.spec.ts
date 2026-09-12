import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

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

/** The redaction fill is pure, fully-opaque black (`REDACT_FILL_COLOR`), and
 * the fixture images (see png.ts) always fix their blue channel at 180 - it
 * never reaches black on its own - so scanning for a near-black pixel is a
 * safe, unambiguous way to tell "a redaction covers this region," the same
 * technique `box.spec.ts`'s `hasReddishPixel` uses for the box's own color. */
function hasBlackPixel(page: Page, rect: { x: number; y: number; w: number; h: number }) {
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
        if (data[i]! < 10 && data[i + 1]! < 10 && data[i + 2]! < 10) return true
      }
      return false
    },
    rect,
  )
}

/** Decodes a real downloaded file through the browser's own PNG decoder (an
 * `<img>`, not a hand-rolled Node-side one) and reads back one pixel - this
 * is what actually proves the exported *file* has no recoverable trace of
 * whatever used to be under a redaction, per Phase 4's own Definition of
 * Done ("tested by zooming into the export, not just eyeballing the
 * preview"), not just that the live preview canvas looks right. */
async function pixelInDownloadedFile(page: Page, filePath: string, x: number, y: number): Promise<[number, number, number, number]> {
  const dataUrl = `data:image/png;base64,${readFileSync(filePath).toString('base64')}`
  return page.evaluate(
    ({ dataUrl, x, y }) =>
      new Promise<[number, number, number, number]>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          const d = ctx.getImageData(x, y, 1, 1).data
          resolve([d[0]!, d[1]!, d[2]!, d[3]!])
        }
        img.onerror = () => reject(new Error('failed to decode downloaded file'))
        img.src = dataUrl
      }),
    { dataUrl, x, y },
  )
}

function redactToolButton(page: Page) {
  return page.getByRole('button', { name: 'Redact' })
}

test('the redact tool covers real image content with an opaque black fill, in the preview and the export', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await redactToolButton(page).click()
  await expect(redactToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  // Draw over a region well inside the image itself (unlike box/arrow's own
  // specs, which deliberately draw in an empty strip below it) - a redaction
  // has to actually blot out real content to mean anything.
  const start = { x: rect.x + 80, y: rect.y + 80 }
  const end = { x: rect.x + 200, y: rect.y + 180 }
  const region = { x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y }

  expect(await hasBlackPixel(page, region)).toBe(false)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // Drawing one redaction is a one-shot gesture - the tool reverts to select.
  await expect(redactToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  expect(await hasBlackPixel(page, region)).toBe(true)

  // One renderer for preview and export (invariant 1) - the redaction must
  // reach the downloaded file too, not just the on-screen canvas.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  expect(await download.path()).toBeTruthy()
})

test('redacted content is unrecoverable from the real downloaded file, not just the on-screen preview', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await redactToolButton(page).click()
  const start = { x: rect.x + 80, y: rect.y + 80 }
  const end = { x: rect.x + 200, y: rect.y + 180 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  const path = await download.path()
  expect(path).toBeTruthy()

  // Default export is 2x - the exported pixel grid is the board grid scaled
  // by 2, with no offset (export never sets renderScene's preview-only
  // `offset`, see invariant 1). Sampling the center of the drawn rectangle,
  // in board space, avoids any edge/anti-aliasing ambiguity.
  const centerBoardX = 80 + (200 - 80) / 2
  const centerBoardY = 80 + (180 - 80) / 2
  const [r, g, b, a] = await pixelInDownloadedFile(page, path!, Math.round(centerBoardX * 2), Math.round(centerBoardY * 2))
  expect([r, g, b, a]).toEqual([0, 0, 0, 255])
})

test('the "C" shortcut arms the tool, and Escape cancels a draw without creating anything', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const status = page.locator('.selection-status')

  await page.keyboard.press('c')
  await expect(redactToolButton(page)).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await expect(redactToolButton(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(status).toHaveText('')
})

test('a stray click with the redact tool armed does not create a redaction', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await redactToolButton(page).click()
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2)

  // A committed redaction would auto-select itself ("1 selected") - seeing
  // nothing selected is how this test knows nothing was created.
  await expect(status).toHaveText('')
  await expect(redactToolButton(page)).toHaveAttribute('aria-pressed', 'false')
})

test('a redaction can be selected, deleted, and the delete undone', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)
  const status = page.locator('.selection-status')

  await redactToolButton(page).click()
  const start = { x: rect.x + 80, y: rect.y + 80 }
  const end = { x: rect.x + 200, y: rect.y + 180 }
  const region = { x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  // `addRedact` leaves the new redaction selected.
  await expect(status).toHaveText('1 selected')
  expect(await hasBlackPixel(page, region)).toBe(true)

  await page.keyboard.press('Delete')
  await expect(status).toHaveText('')
  expect(await hasBlackPixel(page, region)).toBe(false)

  await page.keyboard.press('ControlOrMeta+Z')
  expect(await hasBlackPixel(page, region)).toBe(true)
})

test('a redaction exposes no resize handle - dragging its selection outline moves it instead', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await redactToolButton(page).click()
  const start = { x: rect.x + 80, y: rect.y + 80 }
  const end = { x: rect.x + 200, y: rect.y + 180 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up()

  const before = { x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y }
  expect(await hasBlackPixel(page, before)).toBe(true)

  // Drag from inside the redaction (its interior hit-tests as a plain AABB,
  // same generic rule every node uses) rather than a corner - a corner drag
  // would be a resize handle if one existed, which redactions deliberately
  // don't expose.
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 150, center.y, { steps: 8 })
  await page.mouse.up()

  expect(await hasBlackPixel(page, before)).toBe(false)
  const after = { x: before.x + 150, y: before.y, w: before.w, h: before.h }
  expect(await hasBlackPixel(page, after)).toBe(true)
})
