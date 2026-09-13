import { test, expect } from './fixtures'

/**
 * The privacy claim is the product's main differentiator, so it is enforced by
 * a test rather than by a policy page: after the app has loaded, a full
 * editing session must not talk to the network at all.
 */
test('a whole session runs without a single network request', async ({ page, images, addViaPicker }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Only requests made after the app is up count; loading it obviously needs some.
  const afterLoad: { url: string; method: string; type: string; hasBody: boolean }[] = []
  page.on('request', (r) => {
    if (r.url().startsWith('data:') || r.url().startsWith('blob:')) return
    afterLoad.push({
      url: r.url(),
      method: r.method(),
      type: r.resourceType(),
      hasBody: r.postData() !== null,
    })
  })

  await addViaPicker(page, images([
    [1600, 900],
    [900, 1600],
    [420, 180],
  ]))
  await page.getByRole('button', { name: 'Steps' }).click()
  await page.getByRole('button', { name: 'Soft' }).click()
  await page.getByRole('button', { name: 'Background', exact: true }).click()
  await page.getByRole('button', { name: 'Black', exact: true }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  await download.path()
  await page.waitForTimeout(500)

  // Nothing may ever be uploaded: no request may carry a body, and none may
  // leave this origin.
  expect(afterLoad.filter((r) => r.hasBody)).toEqual([])
  expect(afterLoad.filter((r) => !r.url.startsWith('http://localhost:4173/'))).toEqual([])
  expect(afterLoad.filter((r) => r.method !== 'GET')).toEqual([])

  // The decode worker loads lazily on the first image. The two self-hosted
  // annotation font files (Phase 4 item 3 - see render/text.ts) load once
  // BoardCanvas mounts, warming up before any text/arrow node needs them -
  // same-origin, bundled with the app, not a Google Fonts CDN request (see
  // product plan 9.2 and CLAUDE.md invariant 6). Anything else appearing
  // here needs justifying.
  expect(afterLoad.map((r) => r.url.replace(/-[A-Za-z0-9_]{8,}\./, '.'))).toEqual([
    'http://localhost:4173/assets/decode.worker.js',
    'http://localhost:4173/assets/Inter-Latin-600.woff2',
    'http://localhost:4173/assets/Anuphan-Thai-600.woff2',
  ])
})

test('no third-party origins are contacted even while loading', async ({ page }) => {
  const foreign: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.protocol === 'data:' || url.protocol === 'blob:') return
    if (url.host !== 'localhost:4173') foreign.push(r.url())
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // Self-hosted everything: a webfont CDN would leak the user's IP on every visit.
  expect(foreign).toEqual([])
})
