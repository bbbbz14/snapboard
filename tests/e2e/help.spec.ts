import { test, expect } from './fixtures'

test.use({ viewport: { width: 1200, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('? opens the shortcut cheatsheet even with no images on the board', async ({ page }) => {
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
})

test('the help button in the top bar opens the same modal', async ({ page }) => {
  await page.getByRole('button', { name: 'Keyboard shortcuts (?)' }).click()
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
})

test('Escape closes the modal', async ({ page }) => {
  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('clicking the backdrop closes the modal', async ({ page }) => {
  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(dialog).toBeVisible()

  // Top-left corner of the viewport - well outside the centered dialog.
  await page.mouse.click(10, 10)
  await expect(dialog).not.toBeVisible()
})

test('keys are swallowed while the modal is open - pressing A does not arm the arrow tool underneath', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  // Moves focus off the (still-focused-post-upload) file input, same as a
  // real user clicking the board before doing anything else.
  await page.mouse.click(5, 5)

  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('a')
  await expect(page.getByRole('button', { name: 'Arrow', exact: true })).toHaveAttribute('aria-pressed', 'false')

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})
