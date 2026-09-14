import { test as base, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makePng } from './png'

export interface Fixtures {
  /** Writes PNG fixtures to a temp dir and returns their paths. */
  images: (specs: [w: number, h: number][]) => string[]
  addViaPicker: (page: Page, paths: string[]) => Promise<void>
}

export const test = base.extend<Fixtures>({
  // Clear board now confirms first (misclick safety net); Playwright dismisses
  // dialogs by default, which would silently no-op every existing `Clear
  // board` click in the suite. Auto-accept everywhere so tests keep the old
  // "Clear board" == "board is now empty" behavior.
  page: async ({ page }, use) => {
    page.on('dialog', (d) => void d.accept())
    await use(page)
  },
  // One temp dir per test, removed when the test ends. The `finally` is the
  // whole point: without it this fixture leaked every directory it ever made,
  // and on 2026-09-14 that was 16,487 of them — 11 GB — which took the box's
  // root filesystem to 97% full with 1.8 GB left. Nothing in Snapboard broke,
  // but `/` is only 48 GB and it is shared with two production services whose
  // journald, builds and scratch writes would all have failed together.
  // A fixture that runs thousands of times has to clean up after itself.
  images: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'snapboard-'))
    let n = 0
    try {
      await use((specs) =>
        specs.map(([w, h]) => {
          const path = join(dir, `shot-${n++}-${w}x${h}.png`)
          writeFileSync(path, makePng(w, h, [(n * 40) % 200, (n * 70) % 200, 180]))
          return path
        }),
      )
    } finally {
      // force: a test that never asked for images leaves no dir to remove.
      rmSync(dir, { recursive: true, force: true })
    }
  },
  addViaPicker: async ({}, use) => {
    await use(async (page, paths) => {
      await page.setInputFiles('input[type=file]', paths)
      await page.waitForFunction((n) => document.querySelectorAll('canvas').length > 0 && n > 0, paths.length)
      await page.waitForSelector('.busy', { state: 'detached' }).catch(() => {})
    })
  },
})

export { expect } from '@playwright/test'
