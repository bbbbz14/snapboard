# Snapboard

Turn several screenshots into one clear image you can send — in seconds, with no
sign-in and nothing uploaded.

Paste or drop screenshots, and the board arranges them for you. Adjust only if
you want to. Then copy straight to the clipboard.

> Status: **Phase 1 complete.** Core loop (paste → auto-arrange → copy) works
> end to end. Selection, dragging, undo and annotations are not built yet.

## Why it exists

Sending five screenshots makes the recipient do the work of piecing them
together. Existing options each miss something: online merge tools are fast but
produce raw, unannotated strips; screenshot beautifiers handle one image at a
time; Figma and Canva can do anything but need an account and manual layout.

Snapboard does one thing: get from "I have several screenshots" to "here is one
clear image" as fast as possible.

## Privacy

Images are decoded, arranged and exported entirely in the browser. There is no
backend. After the page loads, the app makes no network requests other than
lazily fetching its own image-decoding worker — and this is enforced by a test
([`tests/e2e/privacy.spec.ts`](tests/e2e/privacy.spec.ts)) and by a
`connect-src 'none'` CSP ([`public/_headers`](public/_headers)), not just by a
policy page.

## Development

```bash
npm install
npx playwright install --with-deps chromium firefox webkit

npm run dev          # dev server
npm run verify       # typecheck + unit + renderer parity + e2e
```

| Command | What it covers |
|---|---|
| `npm run test` | Pure logic: layout engine, file validation, export maths |
| `npm run test:render` | Renderer parity — preview vs export, across three engines |
| `npm run e2e` | Real browser flows: drop, layout, copy, download, privacy, performance |
| `npm run spike` | Phase 0 measurement harness (clipboard, decode cost, canvas limits) |

## Architecture in one paragraph

A single `renderScene()` function draws the board for both the screen and the
exported file, which is what makes "the export matches what I saw" true by
construction rather than by luck. The preview draws through a per-node tile
cache because drop shadows turned out to cost 72–91% of frame time; the export
bypasses the cache and draws at full resolution. State is a small plain object
(image pixels live outside it), so layout is a pure function and undo can be a
snapshot.

## Documentation

- [CLAUDE.md](CLAUDE.md) — working guide: commands, invariants, gotchas.
  Start here before changing code.
- [Manual test checklist](docs/manual-test-checklist.md) *(Thai)* — the checks
  automation cannot cover: real clipboard, real Safari, real users
- [Product plan and analysis](docs/00-product-plan.md) *(Thai)* — problem,
  personas, competitive analysis, roadmap, risks
- [Architecture decisions](docs/decisions/) *(Thai)* — each backed by
  cross-browser measurements
- [Phase reports](docs/phases/) *(Thai)* — what shipped, what was learned,
  what is next
