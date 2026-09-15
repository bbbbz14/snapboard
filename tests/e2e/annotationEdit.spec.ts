import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

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

function toolButton(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true })
}

/** The new button `SelectionToolbar` shows for a single selected annotation
 * node - deliberately a different accessible name from `AnnotationToolbar`'s
 * own "Style" button (see SelectionToolbar.tsx's note) so the two are never
 * ambiguous when both happen to be visible at once. */
function editStyleButton(page: Page) {
  return page.getByRole('button', { name: 'Edit style' })
}

/** Same "scan a region, count matching pixels" technique every other
 * annotation spec uses, since the fixture images are gradients, not flat
 * colors. `height` is the vertical extent between the first and last match,
 * for telling whether drawn content got taller (a bigger font size),
 * without needing to read any digit or glyph. */
function pixelScan(page: Page, rect: { x: number; y: number; w: number; h: number }, mode: 'red' | 'green') {
  return page.locator('canvas.board-canvas').evaluate(
    (el, arg) => {
      const canvas = el as HTMLCanvasElement
      const bcr = canvas.getBoundingClientRect()
      const scale = canvas.width / bcr.width
      const ctx = canvas.getContext('2d')!
      const x0 = Math.max(0, Math.round((arg.rect.x - bcr.x) * scale))
      const y0 = Math.max(0, Math.round((arg.rect.y - bcr.y) * scale))
      const w = Math.min(canvas.width - x0, Math.round(arg.rect.w * scale))
      const h = Math.min(canvas.height - y0, Math.round(arg.rect.h * scale))
      const data = ctx.getImageData(x0, y0, w, h).data
      let count = 0
      let minY = Infinity
      let maxY = -Infinity
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const r = data[i]!
          const g = data[i + 1]!
          const b = data[i + 2]!
          const matches = arg.mode === 'red' ? r > 150 && g < 100 && b < 100 : g > 130 && r < 60 && b < 100
          if (matches) {
            count++
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      return { count, height: count > 0 ? maxY - minY : 0 }
    },
    { rect, mode },
  )
}

test('changing color in "Edit style" recolors the already-placed box in place, and does not change the default for the next one drawn', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Box').click()
  const y1 = rect.y + rect.h + 60
  await page.mouse.move(rect.x + 20, y1)
  await page.mouse.down()
  await page.mouse.move(rect.x + 160, y1 + 40, { steps: 5 })
  await page.mouse.up()
  const region1 = { x: rect.x, y: y1 - 20, w: 200, h: 100 }
  expect((await pixelScan(page, region1, 'red')).count).toBeGreaterThan(0)
  expect((await pixelScan(page, region1, 'green')).count).toBe(0)

  await editStyleButton(page).click()
  const popover = page.getByRole('dialog', { name: 'Style' })
  await expect(popover).toBeVisible()
  await page.getByRole('button', { name: '#16a34a' }).click()
  await editStyleButton(page).click() // close

  expect((await pixelScan(page, region1, 'green')).count).toBeGreaterThan(0)
  expect((await pixelScan(page, region1, 'red')).count).toBe(0)

  // Draw a second box - it must still use the tool's own default (red), not
  // the color that was just applied to the first, already-placed box. Offset
  // horizontally, not stacked further down - the viewport's remaining height
  // below the board varies by engine/zoom, but there's always room to the
  // right at the same y.
  await toolButton(page, 'Box').click()
  const x2 = rect.x + 260
  await page.mouse.move(x2, y1)
  await page.mouse.down()
  await page.mouse.move(x2 + 140, y1 + 40, { steps: 5 })
  await page.mouse.up()
  const region2 = { x: x2 - 20, y: y1 - 20, w: 200, h: 100 }
  expect((await pixelScan(page, region2, 'red')).count).toBeGreaterThan(0)
})

test('the size slider in "Edit style" thickens an already-placed box in place', async ({ page, images, addViaPicker }) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Box').click()
  const y = rect.y + rect.h + 60
  await page.mouse.move(rect.x + 20, y)
  await page.mouse.down()
  await page.mouse.move(rect.x + 160, y + 40, { steps: 5 })
  await page.mouse.up()

  const stripe = { x: rect.x + 90, y: y - 10, w: 1, h: 20 }
  const before = (await pixelScan(page, stripe, 'red')).count

  // The slider is inline next to "Edit style", visible the instant a single
  // sizable annotation is selected - no need to open that popover to reach
  // it. Opening it anyway would race `useFocusTrap`'s own auto-focus (moving
  // focus into the color popover) against this slider's manual `.focus()`
  // call, since size moved out into its own DOM subtree once split from color.
  const slider = page.getByRole('slider', { name: 'Size' })
  await slider.focus()
  await page.keyboard.press('End')

  // Poll rather than read once: the slider's 'End' keypress commits the new
  // size to the store synchronously, but the canvas repaint it triggers is a
  // separate async step (this is the pre-existing, order-dependent flake
  // CLAUDE.md's Phase 5 item 6 note already documents for this file - a
  // plain single read can race it, which the new popover-in entrance
  // animation (Phase 5 item 9) makes noticeably more likely by adding extra
  // main-thread paint work right at that moment).
  await expect.poll(async () => (await pixelScan(page, stripe, 'red')).count).toBeGreaterThan(before)
})

test('the size stepper in "Edit style" grows an already-typed text node without deleting and retyping it', async ({
  page,
  images,
  addViaPicker,
}) => {
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Text').click()
  const at = { x: rect.x + 20, y: rect.y + rect.h + 20 }
  await page.mouse.click(at.x, at.y)
  await page.locator('.text-edit').fill('resize me')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(page.locator('.selection-status')).toHaveText('1 selected')

  const region = { x: at.x - 10, y: at.y - 10, w: 280, h: 140 }
  const before = await pixelScan(page, region, 'red')
  expect(before.count).toBeGreaterThan(0)

  // Text uses a discrete -/+ stepper, not the slider every other sizable
  // annotation uses (see AnnotationSizeStepper's own note on why) - each
  // click is one complete, immediately-committed size change, so there's
  // nothing to poll/race here the way the sibling box-resize test above
  // has to: by the time `click()` resolves, the resize (and its repaint)
  // has already happened.
  const increase = page.getByRole('button', { name: 'Increase size' })
  for (let i = 0; i < 10; i++) await increase.click()

  expect((await pixelScan(page, region, 'red')).height).toBeGreaterThan(before.height)

  // The content itself is untouched - re-opening for edit shows the same text.
  await page.mouse.dblclick(at.x + 5, at.y + 5)
  await expect(page.locator('.text-edit')).toHaveValue('resize me')
  await page.keyboard.press('Escape')
})

test('the size stepper in "Edit style" never flickers between line counts - each click is one complete, correctly-fitted resize', async ({
  page,
  images,
  addViaPicker,
}) => {
  // Regression test for the bug this stepper replaced a slider to fix: a
  // long-enough single line sits near the `TEXT_MAX_WIDTH` wrap boundary at
  // some font size, and `wrapText`'s line count jumps by a whole line right
  // at that boundary rather than growing smoothly - dragging a slider
  // through it made the box visibly bounce between the two line counts.
  // A stepper has no drag gesture to jitter mid-way through, so every
  // click - including the exact one that crosses the wrap boundary - must
  // land on a single, correctly-fitted frame with no intermediate state.
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Text').click()
  const at = { x: rect.x + 20, y: rect.y + rect.h + 20 }
  await page.mouse.click(at.x, at.y)
  await page.locator('.text-edit').fill('This is a fairly long sentence used to test wrapping')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(page.locator('.selection-status')).toHaveText('1 selected')

  const increase = page.getByRole('button', { name: 'Increase size' })
  const region = { x: at.x - 10, y: at.y - 10, w: 500, h: 220 }

  let previousHeight = (await pixelScan(page, region, 'red')).height
  // Steps through the rest of the range once, one click at a time (default
  // size is 22px, max is 40px - 18 clicks reaches the max exactly, so the
  // button never goes disabled mid-loop). Somewhere in there this crosses
  // the exact font size where the sentence wraps onto a third line
  // (confirmed via a throwaway repro to sit around 33-34px for this
  // sentence). Every single click's *result*, read right after that one
  // click resolves, must already be the final, settled height - not an
  // in-between value from a still-catching-up preview.
  for (let i = 0; i < 18; i++) {
    await increase.click()
    const height = (await pixelScan(page, region, 'red')).height
    expect(height).toBeGreaterThanOrEqual(previousHeight)
    previousHeight = height
  }
})

test('the "Edit style" popover opens attached to the button that opened it, not far away', async ({ page, images, addViaPicker }) => {
  // Regression test: `SelectionToolbar` (unlike `AnnotationToolbar`) is
  // positioned with a CSS `transform`, which creates a new containing block
  // for the popover's `position: fixed` - without rendering the popover
  // through a portal, its `bottom`/`left` (computed assuming a
  // viewport-relative fixed position) resolved against the transformed
  // toolbar's own small box instead, landing far from the button. See
  // CLAUDE.md's "third round of real-usage feedback" note.
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Box').click()
  const y = rect.y + rect.h + 60
  await page.mouse.move(rect.x + 20, y)
  await page.mouse.down()
  await page.mouse.move(rect.x + 160, y + 40, { steps: 5 })
  await page.mouse.up()

  const button = editStyleButton(page)
  await button.click()
  const popover = page.getByRole('dialog', { name: 'Style' })
  await expect(popover).toBeVisible()
  // The popover-in entrance animation (Phase 5 item 9) briefly scales/
  // translates the popover on open - wait for it to settle (130ms) before
  // reading its position, or this pixel-exact check can catch it mid-transition.
  await page.waitForTimeout(200)

  const btnBox = (await button.boundingBox())!
  const popBox = (await popover.boundingBox())!
  expect(popBox.x).toBeCloseTo(btnBox.x, 0)
  // The popover sits directly above the button - a small, fixed gap, not
  // "somewhere else on the page".
  const gap = btnBox.y - (popBox.y + popBox.height)
  expect(gap).toBeGreaterThanOrEqual(0)
  expect(gap).toBeLessThan(20)
})

test('dragging the size slider in "Edit style" is one undo step, not one per tick', async ({ page, images, addViaPicker }) => {
  // Regression test: `setNodeSize`/`commitText` (unlike `setGap`) weren't
  // wrapped in `beginAdjustment`/`endAdjustment`, so every 'input' event of
  // a slider drag pushed a full undo-history entry and a full board commit -
  // the same "50+ entries for one gesture" problem already fixed once for
  // the gap slider (see CLAUDE.md's "third round of real-usage feedback").
  await addViaPicker(page, images([[400, 300]]))
  const rect = await pageRect(page)

  await toolButton(page, 'Box').click()
  const y = rect.y + rect.h + 60
  await page.mouse.move(rect.x + 20, y)
  await page.mouse.down()
  await page.mouse.move(rect.x + 160, y + 40, { steps: 5 })
  await page.mouse.up()

  // Inline, visible without opening "Edit style" - see the sibling tests'
  // comments above for why opening it anyway would be actively harmful here
  // (a focus-trap race against this test's own slider interaction below).
  const value = page.locator('.annotation-settings__value')
  const before = await value.innerText()

  const slider = page.getByRole('slider', { name: 'Size' })
  const box = (await slider.boundingBox())!
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()

  const afterDrag = await value.innerText()
  expect(afterDrag).not.toBe(before)

  // One undo reverts the whole drag, back to the pre-gesture value - not one
  // step per tick.
  await page.keyboard.press('Control+z')
  await expect(value).toHaveText(before)
})
