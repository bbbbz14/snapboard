import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

/** Reads width/height straight out of the IHDR chunk - no decoder needed. */
function pngDimensions(buf: Buffer): { w: number; h: number } {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

function estimateNumbers(text: string): [number, number] {
  const [w, h] = text.match(/\d+/g)!.map(Number)
  return [w!, h!]
}

test('export menu opens from the caret, closes on outside click and on Escape', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))

  await page.click('button[aria-label="Export options"]')
  await expect(page.locator('.export-menu')).toBeVisible()

  await page.mouse.click(10, 10)
  await expect(page.locator('.export-menu')).toHaveCount(0)

  await page.click('button[aria-label="Export options"]')
  await expect(page.locator('.export-menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.export-menu')).toHaveCount(0)
})

test('quality slider only appears once JPG is selected, and downloads a real JPEG', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))

  await page.click('button[aria-label="Export options"]')
  await expect(page.locator('.export-menu input[type=range]')).toHaveCount(0)

  await page.click('.export-menu button:has-text("JPG")')
  await expect(page.locator('.export-menu input[type=range]')).toHaveCount(1)

  await page.click('.export-menu button:has-text("PNG")')
  await expect(page.locator('.export-menu input[type=range]')).toHaveCount(0)

  await page.click('.export-menu button:has-text("JPG")')
  await page.keyboard.press('Escape')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.jpg$/)
  const bytes = readFileSync((await download.path())!)
  // JPEG SOI marker - proof this is a real re-encode, not a renamed PNG.
  expect(bytes[0]).toBe(0xff)
  expect(bytes[1]).toBe(0xd8)
})

test('the size estimate shown before export matches what actually downloads, at 1x and 3x', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))

  await page.click('button[aria-label="Export options"]')
  await page.click('.export-menu button:has-text("1x")')
  const [w1, h1] = estimateNumbers((await page.textContent('.export-menu__estimate'))!)
  await page.keyboard.press('Escape')

  const [download1] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(pngDimensions(readFileSync((await download1.path())!))).toEqual({ w: w1, h: h1 })

  await page.click('button[aria-label="Export options"]')
  await page.click('.export-menu button:has-text("3x")')
  const [w3, h3] = estimateNumbers((await page.textContent('.export-menu__estimate'))!)
  expect([w3, h3]).toEqual([w1 * 3, h1 * 3])
  await page.keyboard.press('Escape')

  const [download3] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(pngDimensions(readFileSync((await download3.path())!))).toEqual({ w: w3, h: h3 })
})
