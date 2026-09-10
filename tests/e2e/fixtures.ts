import { test as base, type Page } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makePng } from './png'

export interface Fixtures {
  /** Writes PNG fixtures to a temp dir and returns their paths. */
  images: (specs: [w: number, h: number][]) => string[]
  addViaPicker: (page: Page, paths: string[]) => Promise<void>
}

export const test = base.extend<Fixtures>({
  images: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'snapboard-'))
    let n = 0
    await use((specs) =>
      specs.map(([w, h]) => {
        const path = join(dir, `shot-${n++}-${w}x${h}.png`)
        writeFileSync(path, makePng(w, h, [(n * 40) % 200, (n * 70) % 200, 180]))
        return path
      }),
    )
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
