import { test, expect } from './fixtures'

/**
 * Copy is the product's main exit. Only Chromium can be verified end to end in
 * automation (ADR-003); elsewhere we assert the fallback keeps users unblocked.
 */
test('copy places a real PNG on the clipboard', async ({ page, images, addViaPicker, browserName }) => {
  test.skip(browserName !== 'chromium', 'Headless Firefox and WebKit have no OS clipboard - see ADR-003')
  await page.goto('/')
  await addViaPicker(page, images([[900, 600], [900, 600]]))

  await page.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()

  const clip = await page.evaluate(async () => {
    const items = await navigator.clipboard.read()
    const item = items.find((i) => i.types.includes('image/png'))
    if (!item) return null
    const blob = await item.getType('image/png')
    const bitmap = await createImageBitmap(blob)
    return { bytes: blob.size, w: bitmap.width, h: bitmap.height }
  })

  expect(clip).not.toBeNull()
  expect(clip!.bytes).toBeGreaterThan(1000)
  // Exported at 2x, so the pasted image is larger than the board on screen.
  expect(clip!.w).toBeGreaterThan(900)
})

test('download is always offered next to copy', async ({ page, images, addViaPicker }) => {
  await page.goto('/')
  await addViaPicker(page, images([[600, 400]]))
  await expect(page.getByRole('button', { name: 'Download' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible()
})
