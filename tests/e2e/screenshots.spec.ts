import { test } from './fixtures'

/** Visual smoke-check for manual UX review. Not an assertion suite. */
test.use({ viewport: { width: 1440, height: 900 } })

test('capture UI states', async ({ page, images, addViaPicker }) => {
  await page.goto('/')
  await page.screenshot({ path: '/tmp/shots/1-empty.png' })

  await addViaPicker(page, images([[1600, 1000], [1600, 1000], [1600, 1000]]))
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/shots/2-three-desktop.png' })

  await page.getByRole('button', { name: 'Clear board' }).click()
  await addViaPicker(page, images([[1170, 2532], [1170, 2532], [1170, 2532], [1170, 2532]]))
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/shots/3-four-phones.png' })

  await page.getByRole('button', { name: 'Clear board' }).click()
  await addViaPicker(page, images([[1400, 900], [1400, 900]]))
  await page.getByRole('button', { name: 'Background', exact: true }).click()
  await page.getByRole('button', { name: 'Black', exact: true }).click()
  await page.getByRole('button', { name: 'Soft' }).click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/shots/4-compare-dark.png' })

  await page.getByRole('button', { name: 'Clear board' }).click()
  await addViaPicker(page, images([[1000, 700], [900, 1200], [420, 180], [1600, 500], [800, 800]]))
  await page.getByRole('button', { name: 'Steps' }).click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/shots/5-steps-mixed.png' })
})
