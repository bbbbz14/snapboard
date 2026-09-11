import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  ;(page as unknown as { _errors: string[] })._errors = errors
})

test('first run explains itself without a tour', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Paste a screenshot' })).toBeVisible()
  await expect(page.getByText('Your images stay on your device')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose files' })).toBeVisible()
  // Nothing to configure before starting: no controls until there is content.
  await expect(page.getByRole('button', { name: 'Copy' })).toHaveCount(0)
})

test('dropped images are arranged automatically with no further input', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[1200, 800], [1200, 800], [1200, 800]]))

  const canvas = page.locator('canvas.board-canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('img', { name: /Board with 3 images/ })).toBeVisible()
  // Copy is reachable immediately - the whole point of layout-first.
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeEnabled()
})

test('layout heuristics match the shape of the images', async ({ page, images, addViaPicker }) => {
  // Three wide desktop captures should stack, not sit in a row.
  await addViaPicker(page, images([[2000, 1000], [2000, 1000], [2000, 1000]]))
  const auto = page.getByRole('button', { name: /^Auto/ })
  await expect(auto).toHaveAttribute('title', /Stacked|columns/i)
})

test('changing layout, background and style redraws the board', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[900, 600], [600, 900]]))
  const canvas = page.locator('canvas.board-canvas')
  // The canvas element itself is viewport-sized (see BoardCanvas.tsx); the
  // ".board-page" overlay tracks the board's own logical size instead.
  const boardPage = page.locator('.board-page')

  const sizeOf = () =>
    boardPage.evaluate((el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return `${Math.round(r.width)}x${Math.round(r.height)}`
    })
  const before = await sizeOf()

  await page.getByRole('button', { name: 'Stacked' }).click()
  expect(await sizeOf()).not.toBe(before)

  await page.getByRole('button', { name: 'Black' }).click()
  await page.getByRole('button', { name: 'Soft' }).click()
  await expect(canvas).toBeVisible()
})

test('unsupported files are refused individually, keeping the good ones', async ({ page, images }) => {
  const [good] = images([[400, 300]])
  await page.setInputFiles('input[type=file]', [
    { name: 'shot.png', mimeType: 'image/png', buffer: readFileSync(good!) },
    { name: 'evil.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') },
    { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
  ])
  await expect(page.getByText('SVG files are not supported')).toBeVisible()
  await expect(page.getByText(/notes\.pdf is not a supported image/)).toBeVisible()
  // The valid image still made it onto the board.
  await expect(page.getByRole('img', { name: /Board with 1 image/ })).toBeVisible()
})

test('a tiny screenshot is not blown up to fill the board', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[300, 120]]))
  // The board's own rect (".board-page"), not the viewport-sized canvas -
  // fit-to-view never zooms a small board past 100%, see camera.ts.
  const cssWidth = await page
    .locator('.board-page')
    .evaluate((el: HTMLElement) => el.getBoundingClientRect().width)
  // 300px of image plus 32px padding either side, and not a pixel more.
  expect(cssWidth).toBeCloseTo(300 + 64, 0)
})

test('export produces a real PNG file', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[800, 500], [800, 500]]))
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^snapboard-\d{4}-\d{2}-\d{2}-\d{4}\.png$/)
  const path = await download.path()
  const buf = readFileSync(path!)
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  // 2x export of a two-up board is comfortably larger than a thumbnail.
  expect(buf.length).toBeGreaterThan(5000)
})

test('no console errors during a normal session', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[1000, 700], [700, 1000]]))
  await page.getByRole('button', { name: 'Grid' }).click()
  await page.getByRole('button', { name: 'Clear board' }).click()
  const errors = (page as unknown as { _errors: string[] })._errors
  expect(errors).toEqual([])
})
