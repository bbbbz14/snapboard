import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Playwright restarts the worker after a failing test, which wipes module state.
 * Merge into the file on every write so a partial run still records its findings.
 */
function record(project: string, key: string, value: unknown) {
  mkdirSync(join(here, 'results'), { recursive: true })
  const file = join(here, 'results', `${project}.json`)
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  prev[key] = value
  writeFileSync(file, JSON.stringify(prev, null, 2) + '\n')
  console.log(`\n=== ${key} [${project}] ===\n${JSON.stringify(value, null, 2)}`)
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
  await page.goto('/spikes/harness.html')
  await page.waitForFunction(() => (window as any).spike !== undefined)
})

test('S1 — clipboard capabilities and write', async ({ page }, testInfo) => {
  const caps = await page.evaluate(() => (window as any).spike.clipboardCapabilities())

  const attempt = async (selector: string) => {
    await page.evaluate(() => (window as any).__resetClipboardProbe())
    await page.click(selector)
    await page.waitForFunction(() => (window as any).__lastClipboard !== undefined, null, { timeout: 10_000 })
    const write = await page.evaluate(() => (window as any).__lastClipboard)
    const readBack = await page.evaluate(() => (window as any).spike.readBackImage())
    return { write, readBack }
  }

  const promiseForm = await attempt('#copy-good')
  const awaitedForm = await attempt('#copy-bad')

  // End-to-end proof: copy, then actually paste. `write()` resolving is not
  // evidence the bytes reached the clipboard — Firefox resolves either way.
  await page.evaluate(() => (window as any).spike.clearInputEvents())
  await page.click('#copy-good')
  await page.click('#paste-target')
  await page.keyboard.press('ControlOrMeta+V')
  await page.waitForTimeout(500)
  const pasted = await page.evaluate(() => (window as any).spike.inputEvents())
  const roundTrip = {
    pasteEvents: pasted.length,
    imagesReceived: pasted.reduce((a: number, e: any) => a + e.files.length, 0),
  }

  record(testInfo.project.name, 'S1_clipboard', { caps, promiseForm, awaitedForm, roundTrip })
})

test('S2 — decode throughput for large screenshots', async ({ page }, testInfo) => {
  const batch20x4K = await page.evaluate(() => (window as any).spike.s2Decode(20, 3840, 2160))
  const batch5xFullPage = await page.evaluate(() => (window as any).spike.s2Decode(5, 1440, 12000))
  record(testInfo.project.name, 'S2_decode', { batch20x4K, batch5xFullPage })
})

test('S3 — canvas size limits', async ({ page }, testInfo) => {
  const limits = await page.evaluate(() => (window as any).spike.s3Limits())
  record(testInfo.project.name, 'S3_canvasLimits', limits)
  expect(limits.maxSquare).toBeGreaterThan(4096)
})

test('S4 — single-renderer parity, frame cost, hit-test cost', async ({ page }, testInfo) => {
  const render = await page.evaluate(() => (window as any).spike.s4Render(9))
  const hit = await page.evaluate(() => (window as any).spike.s4HitTest(100))
  const frameCost = await page.evaluate(() => (window as any).spike.s4FrameCost(9))
  record(testInfo.project.name, 'S4_renderer', { render, hit, frameCost })
  // The architecture bet: the export path must reproduce the preview exactly.
  expect(render.parityA_exportRoundTrip.maxChannelError).toBeLessThanOrEqual(1)
  // And geometry must scale exactly, not approximately.
  expect(render.parityB_landmark.exactlyDoubled).toBe(true)
})

test('S5 — paste and drop extraction', async ({ page }, testInfo) => {
  const attach = async (kind: 'paste' | 'drop', files: { name: string; type: string }[]) => {
    await page.evaluate(
      async ({ kind, files }) => {
        const dt = new DataTransfer()
        for (const f of files) {
          const c = new OffscreenCanvas(64, 64)
          c.getContext('2d')!.fillRect(0, 0, 64, 64)
          const blob = await c.convertToBlob({ type: 'image/png' })
          dt.items.add(new File([blob], f.name, { type: f.type }))
        }
        const ev =
          kind === 'paste'
            ? new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
            : new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })
        window.dispatchEvent(ev)
      },
      { kind, files },
    )
  }
  await attach('paste', [{ name: 'shot.png', type: 'image/png' }])
  await attach('drop', [
    { name: 'a.png', type: 'image/png' },
    { name: 'b.jpg', type: 'image/jpeg' },
    { name: 'evil.svg', type: 'image/svg+xml' },
    { name: 'report.pdf', type: 'application/pdf' },
  ])
  const events = await page.evaluate(() => (window as any).spike.inputEvents())
  record(testInfo.project.name, 'S5_input', events)
  expect(events[1].rejected).toEqual(['evil.svg', 'report.pdf'])
})
