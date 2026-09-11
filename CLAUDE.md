# Snapboard — working guide

Web app that turns several screenshots into one clear image, fast, with no
sign-in and nothing uploaded. Layout-first: dropping images already produces a
sendable result; manual arrangement is the escape hatch, not the main path.

---

# START HERE — what this session should do next

**Current state:** Phase 1 complete. `npm run verify` green (typecheck + unit +
renderer parity on 3 engines + 49 e2e passed, 2 skipped by design — clipboard
round-trip on headless Firefox/WebKit, see ADR-003, not a failure). The manual
test checklist has now been run for real (see below) and the gate is cleared.
Phase 2 has **not** been started — no code, no scaffolding. Start there.

## ✅ The site is live, and `main` is pushed

**https://snapboard.kaomatumaraiwa.com** — GitHub Pages, `gh-pages` branch,
HTTPS enforced, certificate approved, all assets verified 200 from the command
line. Source is on GitHub too: `git push origin master:main` succeeded once
the token got **Workflows: Read and write** (it already had Contents and
Pages), and CI ran on the push. Redeploy the site after any code change with
`bash scripts/deploy-pages.sh` (build → gh-pages orphan commit → Pages API);
it's idempotent. Push source changes the normal way: `git push origin master:main`.

DNS is a Cloudflare zone, record `snapboard` → `bbbbz14.github.io`, set to
**DNS only** — it must stay unproxied, or GitHub can't authorise the domain
or issue the certificate.

**Confirmed caveat — the live site serves no security headers.**
`curl -I` returns only `server` and `cache-control`; no CSP, no HSTS, no
`X-Content-Type-Options`. [public/_headers](public/_headers) is
Netlify/Cloudflare Pages syntax and GitHub Pages ignores it, so invariant 6 is
**not** enforced in production — only by
[tests/e2e/privacy.spec.ts](tests/e2e/privacy.spec.ts). Harmless for manual
testing (the app makes no requests at all), but never cite the live headers as
evidence for that invariant.

## ✅ Gate cleared — manual test checklist run on desktop

The user ran [docs/manual-test-checklist.md](docs/manual-test-checklist.md)
against the live URL. **Sections A–D passed, including A (clipboard)** — the
thing that would have reordered Phase 2 if it had failed. It didn't, so the
planned order below stands.

- **Section E (robustness/edge cases) and F (privacy)** — not run yet. Still
  open; not blocking, but don't claim them as verified.
- **New finding, desktop-only testing so far:** on mobile, the top bar/toolbar
  requires horizontal scrolling to reach — awkward to use. Not filed as a
  Phase 2 item (user wants it noted, not built now); revisit when doing
  mobile-specific work, likely alongside or after Phase 5 polish. Keep this in
  mind if any Phase 2 UI (zoom controls, selection handles) adds more to that
  bar — it makes the overflow worse, not better.
- Real Safari/Firefox and non-Chromium mobile browsers still haven't been
  explicitly confirmed one by one — if that level of detail matters before
  Phase 2, ask the user which browsers they actually used.

## ⛔ Gate before writing any Phase 2 code

Cleared — see above. Proceed with the Phase 2 order below.

## Phase 2 — Manual control and undo

Objective: give the user an escape hatch when auto-layout is not what they
wanted. Build in this order; each item is independently shippable.

1. **Zoom, pan, zoom indicator, fit-to-view button.**
   The clearest gap in Phase 1: a tall board is silently scaled to ~34% and the
   user has no idea. Do this first — it is small and it affects every other
   Phase 2 interaction.
2. **Selection** — click, shift-click, marquee. Draw handles on the interaction
   layer, not the content layer (ADR-002).
3. **Move and resize** with snapping and alignment guides. Resize keeps aspect
   ratio. Keep in-progress geometry in a ref, not React state; commit to the
   store on pointer-up only.
4. **Switching to manual must be explicit.** The first drag flips
   `layout` to `'free'` and shows "Auto layout off · [Turn back on]". Auto-layout
   must never silently overwrite manual work.
5. **Drag to reorder** while still in an auto mode (step badges renumber).
6. **Delete, duplicate, z-order.**
7. **Undo/redo** by snapshotting `Board`. Board state is a few KB of JSON with
   no pixels in it, so snapshots are correct and cheap — do not build
   patch/inverse-op machinery.
8. **Autosave to IndexedDB** so closing the tab does not lose work. Restore with
   a dismissible "Recovered your last board · [Start fresh]" bar. Assets are
   Blobs in IDB, reference-counted.
9. **Full keyboard shortcut set** — see section 14 of the product plan. Avoid
   shortcuts the browser owns.

**Phase 2 is done when:** dragging 10 images holds 60fps · undo goes back 50
steps · closing and reopening the tab preserves the board · every action has a
shortcut · the Definition of Done in
[docs/00-product-plan.md](docs/00-product-plan.md) section 16 is fully met.

## After Phase 2

Phase 3 export hardening (1x/2x/3x, JPG, cross-browser fallbacks) · Phase 4
annotations (arrow, box, text, number, redact, crop) · Phase 5 polish, dark
mode, Thai UI · Phase 6 persistence and PWA · Phase 7 Chrome extension.
Full definitions in [docs/00-product-plan.md](docs/00-product-plan.md)
section 12.

## When a phase finishes

1. Run `npm run verify` and make sure it is green.
2. Write `docs/phases/phase-N.md`: what shipped, what was learned, what is
   deliberately still missing, what is next.
3. **Update this START HERE section** so the next session needs to read nothing
   else to know where to begin.
4. Commit, then stop and report — do not roll straight into the next phase.

---

**Background:** [docs/phases/phase-1.md](docs/phases/phase-1.md) records the
three bugs found during Phase 1 and the measured performance numbers.

## Commands

```bash
npm run dev           # dev server on :5173
npm run verify        # typecheck + unit + renderer parity + e2e  (run before committing)

npm run test          # vitest, pure logic only, no browser
npm run test:render   # renderer parity across 3 engines (needs dev server, auto-starts)
npm run e2e           # full browser flows (builds + previews on :4173)
npm run spike         # Phase 0 measurement harness, not a pass/fail suite
```

Playwright browsers are already installed. `npm run verify` takes ~60s.

## Invariants — breaking these breaks the product

**1. One renderer for preview and export.**
`renderScene()` in [src/board/render/renderScene.ts](src/board/render/renderScene.ts)
draws both the screen and the exported file; the only difference is `scale`.
This is what makes "the export matches what I saw" true structurally. Anything
that draws only on one path is a bug waiting to happen.

The subtle version of this bug already happened once: `exportBoard` created its
context with `{ alpha: false }`, which flipped Chromium to subpixel text
antialiasing and made exported glyphs differ from the preview by up to 100
levels per channel. **Both contexts must be created with identical options.**
`npm run test:render` is what catches this class of bug — run it after touching
anything in `render/` or `export/`.

**2. Tile cache keys must not include position.**
[tileCache.ts](src/board/render/tileCache.ts) pre-renders each node because drop
shadows cost 72–91% of frame time (ADR-002). Adding `x`/`y` to `tileKey()` would
silently rebuild every tile on every drag and destroy the 18–23x speedup.
Size, style and pixel ratio are the only things that may invalidate a tile.

**3. Image pixels live outside the store.**
`AssetStore` is a module singleton; `Board` holds only `assetId` references. That
keeps board state a few KB of JSON, which is why undo can be a plain snapshot
instead of patch/inverse-op machinery. Do not put `ImageBitmap` or `Blob` into
zustand state.

**4. `layout: 'free'` is sacred.**
Once the user arranges something manually, `relayout()` must return the board
untouched. Auto-layout jumping in over manual work is the worst UX failure this
product can have.

**5. Never upscale an image.**
`ALLOW_UPSCALE = false` in [computeLayout.ts](src/board/layout/computeLayout.ts).
A blown-up 400px error dialog looks broken. Small images stay small.

**6. No network, ever.**
No backend, no fonts from a CDN, no analytics in the editor. Enforced by
[tests/e2e/privacy.spec.ts](tests/e2e/privacy.spec.ts) and by
`connect-src 'none'` in [public/_headers](public/_headers). Adding any `fetch`
fails the test — that is intentional.

**7. User text never enters the DOM as HTML.**
Captions and labels are drawn with `fillText` on canvas. This keeps the XSS
surface near zero. When Phase 4 adds a text tool, the editing overlay must read
`textarea.value` only.

**8. SVG is rejected on input.**
It is a scriptable document, and nothing here needs vector input. See
[validate.ts](src/assets/validate.ts).

## Where things live

```
src/board/model/      types, style presets, defaults
src/board/layout/     computeLayout + the auto-mode heuristic (pure, well tested)
src/board/render/     renderScene, tileCache
src/board/store/      zustand store, board -> RenderInput adapter
src/board/export/     exportBoard, clipboard, download
src/assets/           validation, decode worker, AssetStore
src/ui/               TopBar, BoardCanvas, EmptyState, Toasts
src/hooks/            paste and drop handling
src/i18n/             all user-facing copy (en.ts) — no hardcoded strings in components
docs/decisions/       ADRs, each backed by cross-browser measurements
spikes/               Phase 0 harness; throwaway code, kept for its numbers
tests/render/         renderer parity harness (imports src directly, dev server only)
```

## Gotchas learned the hard way

- **Timing canvas work requires a flush.** Read one pixel with `getImageData`
  before reading the clock, or WebKit reports 0 ms because rasterisation is
  asynchronous. Every perf measurement in this repo does this.
- **`clipboard.write()` resolving is not proof.** Firefox resolves it with an
  empty clipboard. Never gate the "Copied" message on the promise alone, and
  never hide the Download button (ADR-003).
- **Firefox ignores `clipboardData` passed to the `ClipboardEvent` constructor.**
  Synthetic paste tests cannot run there; test `extractFiles()` as a unit
  instead (ADR-006).
- **Firefox parity tolerance is looser on purpose** (≤24 vs ≤2). Rounded-corner
  alpha composites twice through the tile cache. The export side is the accurate
  one. Do not relax the other engines to match (ADR-007).
- **`noUncheckedIndexedAccess` is on.** Array and record access is
  `T | undefined`; use `!` only where an invariant genuinely guarantees it.
- **Canvas limits are about area, not edge length.** 4000×65472 is fine;
  20000×20000 is not. `resolveScale()` steps the export scale down rather than
  letting it fail (ADR-005).
- **Safari is the worst case for everything.** Decoding is ~4x Chromium.
  Performance budgets are per-engine, not global.

## Product guardrails

Every proposed feature has to answer one question:

> Does this shorten **Time-To-Copy**, or help the recipient understand faster?

If the answer is not immediate, it does not get built. The list of things
deliberately excluded — rotation, group/lock, align/distribute, layers panel,
brightness/contrast, freehand drawing, template gallery, accounts, cloud, AI
enhance — is in section 5 of [docs/00-product-plan.md](docs/00-product-plan.md)
and is a commitment, not a backlog.

## Not yet verified

Automation here runs headless on Linux, so three things remain unproven and
need a real machine:

1. Copy → paste into Slack, LINE, Jira, Gmail, Word.
2. Paste *from* Windows Snipping Tool and macOS Cmd+Shift+4.
3. Copy on real Safari and real Firefox (only Chromium is confirmed).

Checklist to work through:
[docs/manual-test-checklist.md](docs/manual-test-checklist.md).
Human Time-To-Copy (<20s target) has also not been measured with real people.
