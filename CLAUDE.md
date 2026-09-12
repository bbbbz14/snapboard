# Snapboard — working guide

Web app that turns several screenshots into one clear image, fast, with no
sign-in and nothing uploaded. Layout-first: dropping images already produces a
sendable result; manual arrangement is the escape hatch, not the main path.

---

# START HERE — what this session should do next

**Current state:** Phase 1 complete, manual test checklist gate cleared (see
below). Phase 2 is complete — all 9 items done, shipped (`69cc234`), pushed
to `main`, and deployed to the live site — see
[docs/phases/phase-2.md](docs/phases/phase-2.md). A small unplanned addition —
the "Clear board" misclick safety net (confirm dialog + a one-snapshot
restore, see the note right below) — also shipped, pushed, and deployed
(`4df51c6`). **Phase 3 (export hardening) is now feature-complete, shipped
(`1de8743`), pushed to `main`, and deployed to the live site** — see
[docs/phases/phase-3.md](docs/phases/phase-3.md) for the full writeup. Most of
Phase 3's feature list (scale/format/quality plumbing, the canvas-size guard,
transparent-background handling, meaningful filenames, clipboard fallback,
the copy shortcut) turned out to already exist from Phase 1/2 - the only real
gap was a UI to choose scale/format/quality and preview the output size
before exporting, which this session built as a small popover off a new
Download/▾ split button in `TopBar.tsx`.
`npm run verify` green (typecheck + 151 unit + 27 renderer parity on 3 engines
+ 139 e2e passed, 5 skipped by design — clipboard round-trip on headless
Firefox/WebKit for both the Copy button and the Ctrl/Cmd+Shift+C shortcut
(ADR-003), plus the reorder pixel-swap assertion on headless WebKit only, see
the WebKit rasterisation gotcha below — none of these are failures).

**Next session should either close the open manual-testing gaps (see below)
or start Phase 4** (annotations: arrow, box, text, number, redact, crop) —
see "After Phase 3" below for the full Phase list. Neither gap blocks
starting Phase 4; ask if unsure which the user wants prioritized.

### Phase 3 — done: export options (scale/format/quality) UI

Shipped as its own commit (`1de8743`). Pushed to `main` and deployed to the
live site. See [docs/phases/phase-3.md](docs/phases/phase-3.md) for the full
writeup.

- Almost all of Phase 3's feature list already existed from Phase 1:
  `exportBoard.ts` already had `scale: 1|2|3`, PNG/JPEG with `quality`, the
  `resolveScale`/`SAFE_PIXEL_AREA` canvas-size guard (ADR-005, unit-tested up
  to 20000×20000), transparent-PNG/white-backdrop-for-JPEG handling, and
  meaningful filenames. Clipboard fallback (ADR-003) and the copy shortcut
  (Phase 2 item 9) covered the other two feature-list lines. The only real
  gap: nothing in the UI let the user actually choose scale/format/quality —
  `TopBar.tsx`'s Download always hardcoded `{ scale: 2, format: 'image/png' }`.
- New `src/ui/ExportMenu.tsx` — a small popover opened from a caret (`▾`)
  that turns the old single Download button into a **split button**
  (`Download` | `▾`). Clicking `Download` itself still exports immediately
  with whatever was last chosen (defaults match the old hardcoded behavior:
  2x/PNG) — no extra click for the common case. The caret only opens/closes
  the popover that lets you change those settings; there's no separate
  "confirm" button inside it.
  Popover contents: Format (PNG/JPG, reusing the existing `.group`/`.chip`
  classes), Size (1x/2x/3x, same classes), a Quality slider shown only when
  JPG is selected, and a live pixel-size estimate computed with the exact
  same `resolveScale`/`estimatePixels` functions `exportBoard` uses for the
  real export — one source of truth, so the preview number can't drift from
  what actually downloads (pinned by `tests/e2e/exportOptions.spec.ts`, which
  checks the estimate against the real downloaded file's IHDR dimensions at
  both 1x and 3x). Closes on outside click or Escape.
- **Copy deliberately gets none of these options** — `copyImageToClipboard`
  writes a `ClipboardItem` with MIME `'image/png'` fixed, and the Clipboard
  API doesn't support JPEG across engines anyway. Copy stays the fast,
  zero-decision path; Download is now the one with control. Don't add a
  scale/format choice to Copy — there's no clipboard MIME type to put a JPEG
  in.
- Why a popover and not permanent controls in the top bar: the standing
  mobile-overflow finding (see below) already says not to add more to that
  bar. A caret that only grows the bar by one small button in its resting
  state, with everything else on demand, follows the same reasoning
  `ZoomControls` and `SelectionToolbar` already used to justify living
  outside the top bar entirely.
- Deliberately not done: no e2e test that actually allocates a ~15000px
  canvas to prove the guard doesn't crash a real browser — the unit test's
  20000×20000 case plus ADR-005's real per-browser measurements already cover
  it; a live test here would re-prove the same math at a much higher cost.
  No persistence of the chosen format/scale/quality across sessions either —
  nothing in the product plan asks for it, and it's a UI preference, not
  board content (same reasoning camera/selection state already got).
- **Still open, and can't be closed from inside this environment:** Phase
  3's own DoD item — pasting the exported file into real Slack, LINE, Jira,
  Gmail, Word, Figma, Google Docs and recording a results table — needs a
  human with accounts and screens in those apps.

### Unplanned addition — done: "Clear board" misclick safety net

Not a numbered Phase 2/3 item - a small standalone fix requested mid-session
because `clear()` had no confirmation and no way back once the 800ms autosave
overwrote the board record. `npm run verify` green, pushed to `main` and
deployed to the live site (`4df51c6`).

- `TopBar.tsx`'s Clear button now confirms (`window.confirm`, no new modal
  component - the codebase had no existing dialog primitive and this is a
  one-off) before calling `store.clear()`. This alone stops most misclicks;
  everything below is the safety net for the rest.
- Investigating this turned up that `clear()` already routed through
  `commitBoard` like every other mutation, so the board it empties was
  already landing in undo `past` - **Ctrl/Cmd+Z immediately after a Clear
  already worked, with no code changes.** The actual gap was reload/tab-close
  before hitting undo: `past`/`future` are memory-only, and the 800ms
  autosave debounce (item 8) overwrites the persisted board with the new,
  empty one regardless.
- Closed that gap with a second, separate IndexedDB snapshot - `boardStore`'s
  `clear()` now also fires `saveLastCleared()` (`src/board/persist/autosave.ts`)
  immediately (not debounced - the normal autosave's own diff would otherwise
  delete these same assets out from under it on its next 800ms tick) into a
  new `lastCleared` object store (`src/board/persist/db.ts`, `DB_VERSION`
  bumped 1→2; `onupgradeneeded` only adds the store, so existing installs
  upgrade with no data loss). One slot, not a history - deliberately scoped
  to "undo the last Clear," not a version-history feature, which would be far
  more than this problem calls for.
- New store field `lastCleared: Board | null` + `restoreLastCleared`/
  `dismissLastCleared` actions. `restoreLastCleared` routes through the
  normal `commitBoard`, so restoring is itself a normal undoable commit.
  `hydrate()` now also checks for a last-cleared snapshot (decoding it the
  same way it already decodes a normal autosave recovery) whenever the
  regular autosave restore comes back empty; if it comes back non-empty
  instead, the last-cleared snapshot is stale and gets wiped rather than
  shown. `lastCleared`'s assets are included in every `reconcileAssets` call
  alongside `past`/`future`, since a snapshot the UI is still offering can
  outlive its place in the 50-entry undo cap.
- `src/ui/ClearedBar.tsx` - "Board cleared · Restore" (plus dismiss),
  mounted in `App.tsx` next to the existing `RecoveryBar`. Deliberately a
  second small bar, not a merged/generalized one: the two answer different
  questions ("you left with unsaved work" vs "you just cleared this, want it
  back?") and the existing `RecoveryBar` had no natural way to express the
  second without being misleading. `clear()` also nulls out any stale
  `recoveredBoard` so the two banners can't both show for the same content.
- **Test-suite side effect worth knowing about:** Playwright dismisses
  `window.confirm` by default, which would have silently no-op'd every
  existing `Clear board` click across the e2e suite. Fixed once, centrally,
  in `tests/e2e/fixtures.ts`'s `page` fixture (`page.on('dialog', d =>
  d.accept())`) rather than touching every call site.
- `tests/e2e/clearedBoard.spec.ts` (new) covers confirm→restore in one
  session, restoring-then-undoing, surviving a reload before restoring, and
  dismiss (including that dismiss doesn't come back after a reload).
  `tests/unit/persist.test.ts` and `tests/unit/boardStore.test.ts` cover the
  IndexedDB layer and the store actions respectively, same split as item 8.

### Phase 2 item 1 — done: zoom, pan, zoom indicator, fit-to-view

Shipped as its own commit, pushed and deployed to the live site.

- `src/board/view/camera.ts` — pure camera model (`zoom` + board-space
  `center`), fully unit-tested in `tests/unit/camera.test.ts`. Deliberately
  outside `Board`/zustand: the camera is where the user is looking, not
  something undo or autosave should ever snapshot.
- **Architecture change from Phase 1:** the `<canvas>` in `BoardCanvas.tsx` is
  now sized to the *viewport*, not the board. At high zoom a board-sized
  backing store would blow past the canvas area limit in ADR-005; a
  viewport-sized one stays bounded at any zoom. `renderScene()` gained one
  optional field, `offset` (device-px translate), so the preview can be
  positioned inside that fixed-size canvas — export never sets it, so
  invariant 1 (one renderer, `alpha` options identical) is untouched; all 27
  parity tests still pass with no changes on the export side.
- The old CSS trick (a canvas sized exactly to the board, with a checkerboard
  `background-image` showing through transparent pixels) no longer works once
  the canvas is viewport-sized. It's now a separate `.board-page` div
  (shadow, rounded corners, checkerboard) that `BoardCanvas` repositions every
  frame to match the board's current on-screen rect. Two existing e2e
  assertions that read `canvas.width`/`getBoundingClientRect()` on the canvas
  itself were repointed at `.board-page` — see `tests/e2e/board.spec.ts`.
- Controls: ctrl/cmd+wheel zooms at the pointer (also how trackpad pinch is
  reported); plain wheel pans (replaces the scrollbars a fixed-size canvas
  used to get for free); space+drag or middle-drag pans; `+`/`-`/`0`(fit)/
  `1`(100%) keys, no modifier, so browser zoom shortcuts are untouched.
  Zoom % + fit button sit bottom-right per the product plan's screen layout,
  not in the top bar — which already overflows on mobile (see below).
- `tests/e2e/zoom.spec.ts` covers the indicator, the shortcuts, and — the
  one that actually matters — that zooming/panning the preview and then
  exporting produces byte-identical output to exporting without touching the
  camera at all.
- Known follow-up, not a blocker: `TileCache.setRatio()` clears every tile
  when the ratio changes by more than 0.001 (ADR-002), so a smooth wheel-zoom
  gesture rebuilds all tiles on nearly every tick. Fine at Phase-1 image
  counts; worth checking against the "drag 10 images at 60fps" DoD once item
  3 (move/resize) is in and there's a realistic node count to test with.

### Phase 2 item 2 — done: selection (click, shift-click, marquee)

Shipped as its own commit (`0326b11`). Pushed and deployed to the live site.

- `selectedIds` lives in the zustand store but **not** inside `Board` — same
  reasoning as the camera: undo/autosave snapshot `Board`, and selection is
  not arranged content, just what the user is currently pointing at. `clear()`
  resets it; item 6's `deleteSelected` is the other place that prunes it
  (clears the selection when the nodes it pointed at are removed).
- `src/board/interact/hitTest.ts` — pure, unit-tested (`tests/unit/hitTest.test.ts`)
  AABB point/rect hit-testing. No rotation to account for (`ImageNode.frame`
  has none, by design), so this is plain rect math, not a general hit-test.
- **`BoardCanvas.tsx` is now two canvases**, per ADR-002's "2 canvas layers"
  decision: `.board-canvas` (content, tile-cached) and the new
  `.board-interaction` (selection outline, corner handles, marquee rect),
  both viewport-sized and redrawn with the same `boardToScreen` transform.
  `.board-interaction` has `pointer-events: none` — `.board-canvas` still owns
  every gesture listener, so the two layers never fight over events.
  Selection/marquee pointer handling is its own `useEffect` on `.board-canvas`,
  separate from the pan effect; they don't conflict because the pan effect
  already ignores plain left-click (`button !== 1 && !(button 0 && space)`).
- A `.selection-status` visually-hidden `aria-live` region announces the
  count, per ADR-001's a11y-compensation note (canvas has no DOM semantics)
  and because canvas pixels aren't queryable by Playwright — it's also what
  `tests/e2e/selection.spec.ts` asserts against.
- **What's drawn but not yet wired:** the four corner squares are visual only
  — dragging them does nothing until item 3 (move/resize) wires it up.
- Escape and a plain click on empty space both clear the selection.

### Phase 2 item 3 — done: move and resize, with snapping and alignment guides

Shipped as its own commit (`f2f08fc`). Pushed and deployed to the live site.

- New store action `setFrames` commits moved/resized frames directly and
  **skips `relayout()`** — a manual edit must never be recomputed away.
  (Item 4 builds directly on this: it's also the one place that flips
  `layout` to `'free'`.)
- Move and resize follow the exact ref-first pattern the camera already
  established for pan/zoom: `moveRef`/`resizeRef`/`dragFramesRef` hold
  in-progress geometry, `draw()` and `drawInteraction()` are called directly
  on every pointermove (bypassing React state for 60fps), and the store only
  hears about it once, via `setFrames`, on pointer-up.
- **Bug caught by the resize e2e test, not by eye:** the first version
  cleared `dragFramesRef` *before* the final `draw()` call on pointer-up,
  so the store's `setFrames` update (which reaches `BoardCanvas` as a prop
  asynchronously via React) hadn't landed yet, and that one frame briefly
  rendered the pre-resize size. Fixed by clearing the ref *after* the final
  draw. Worth remembering for item 5+: any "commit ref state, then redraw"
  handler needs the same ordering.
- `src/board/interact/resize.ts` — pure, aspect-locked resize anchored at the
  opposite corner. `src/board/interact/snap.ts` — pure, per-axis edge/center
  snapping against other nodes and the board bounds. `src/board/interact/handles.ts`
  — shared corner-point math + screen-space handle hit-testing, used by both
  the hit-test and `drawInteraction`'s handle-square drawing.
- **Deliberate scope cuts:** resize is always single-node, even with a
  multi-selection (no group-resize-together). Snapping only applies to move,
  not resize — combining edge-snap with an aspect-ratio constraint on one
  freely-dragged corner is real extra complexity the aspect lock mostly
  already covers. A resize that pushes past the board's own edge clips in
  preview and export alike, since a drag never grows `board.size` — resizing
  the board itself for free-layout boards is unscoped follow-up work.
- `tests/e2e/moveResize.spec.ts` samples pixels directly off the live
  `canvas.board-canvas` (`getImageData`, converted from page-space to the
  canvas's own backing-store coordinates) rather than decoding an exported
  PNG — simpler and enough to prove a drag actually moved/resized the node
  and that it's still there after export.

### Phase 2 item 4 — done: switching to manual must be explicit

Shipped as its own commit (`6733b51`). Pushed and deployed to the live site.

- `setFrames` (item 3's only commit path for a move/resize) now sets
  `layout: 'free'` in the same update — so from the very next action, even
  one unrelated to layout like changing the gap slider, `relayout()`'s
  existing `if (board.layout === 'free') return board` guard (invariant 4)
  already protects the manual arrangement. There was no separate "did the
  user just drag for the first time" flag to add.
- `TopBar.tsx`: when `board.layout === 'free'`, the layout-chip group is
  replaced by "Auto layout off · Turn back on" (`.free-banner`) instead of
  showing alongside the chips — none of the chips include `'free'`, so
  they'd otherwise all show unpressed, which reads as broken, not as "off
  on purpose." "Turn back on" calls `setLayout('auto')` — explicit and
  reversible, never automatic.

### Phase 2 item 5 — done: drag to reorder while still in an auto layout

Shipped as its own commit (`b3584b4`). Pushed and deployed to the live site.

- New store action `reorder(id, targetIndex)`: moves a node to a target
  index in the order sequence and calls `relayout()` — unlike `setFrames`,
  it does **not** switch `layout` to `'free'`. Frames and step badges follow
  from `order` the same way `addFiles`/`setGap` already make them.
- `BoardCanvas` now branches a node-drag on `board.layout`: `'free'` keeps
  item 3's free-form move; any auto mode floats just the dragged node to
  follow the pointer (via `dragFramesRef`, without reflowing the rest of the
  board - `computeLayout` is too slow to call every pointermove, ~50ms at a
  dozen images per `performance.spec.ts`) while a dashed outline marks
  whichever other node it's hovering as the drop target. Drop onto a node →
  `reorder`. Drop on open space → the same manual-escape-hatch path
  `setFrames` already provides (item 4) — one gesture, two outcomes
  depending on where it lands.
- **Real bug caught here, not just an e2e nuisance:** headless WebKit can
  leave the preview canvas showing stale (pre-reorder) pixels for an
  unbounded stretch after two same-size cached tiles swap position in one
  redraw. Confirmed by direct tile/store inspection that the committed
  `Board` and the tiles themselves are correct immediately - this is a
  WebKit repaint gap, not a data bug. See the new gotcha below; the
  `tests/e2e/reorder.spec.ts` pixel-swap assertion skips on WebKit rather
  than retrying forever (same pattern as ADR-003's clipboard skip).

### Phase 2 item 6 — done: delete, duplicate, z-order

Shipped as its own commit (`4a72ead`). Pushed and deployed to the live site.

- Scope was pinned to the product plan's own mockup (docs/00-product-plan.md
  4.2): "when an object is selected, a small floating toolbar appears above
  it: [Crop] [Duplicate] [Bring to front] [Delete]." Crop is Phase 4. That's
  why this item ships exactly three actions (no send-to-back/forward/backward)
  - nothing here has a caller yet, and unused store actions are exactly the
  kind of speculative surface CLAUDE.md says not to add.
- `src/board/model/zorder.ts` — pure, unit-tested (`tests/unit/zorder.test.ts`)
  `moveToFront`, reused by the store's `bringToFront` action. `order` is
  already the z-order (hitTest.ts picks the highest `order` under the
  pointer, and `toRenderInput` paints in ascending `order`), so "bring to
  front" is just "give these ids the highest `order` values."
  `deleteSelected`/`duplicateSelected`/`bringToFront` all renumber `order` to
  0..n-1 after they run, same as `reorder` already does.
- `duplicateSelected` calls the new `AssetStore.retain()` (mirrors `release()`)
  so the copy shares the same asset with a correct refcount (invariant 3) -
  matches the product plan's explicit note that a deleted node's asset must
  only be freed when its refcount hits zero, "because one image might have
  been duplicated." The copy is offset by 16 board-space px so it doesn't
  render exactly on top of the original, then is left selected instead of it.
  (Superseded by item 7: `retain`/`release` don't exist anymore, replaced by
  a history-aware `AssetStore.reconcile()` - see below for why.)
- `deleteSelected` calls `AssetStore.release()` for each removed node and
  clears `selectedIds` - the pruning item 2's note asked for. (Same item 7
  note as above - the call site is gone, the pruning behavior isn't.)
- All three actions call `relayout()` after touching `nodes`. For a `'free'`
  board that's a no-op on frames (invariant 4) so only `order`/membership
  changes; for an auto board it also repositions everything, same overload
  of `order` that item 5's `reorder` already leans on for drag-to-reorder.
- `src/ui/SelectionToolbar.tsx` - a small floating DOM toolbar, not more
  chips in `TopBar`, per the mockup and per the standing mobile-overflow
  caution (see the manual-test-checklist finding below). Its position is
  written directly onto the element in `BoardCanvas`'s `drawInteraction`
  (ref-first, same pattern as `.board-page` and the drag code) so it tracks
  the selection during a drag without a React re-render, and is hidden
  outright while a move/resize/marquee/reorder gesture is in progress.
- Delete is also bound to the Delete/Backspace key (no modifier, so nothing
  the browser owns is at risk - see the existing zoom-shortcut gotcha).
  Duplicate and bring-to-front are toolbar-only for now; a modifier-key
  binding for them (e.g. the industry-standard but browser-reserved-in-places
  Ctrl/Cmd+D) is exactly the kind of thing item 9's full keyboard pass should
  decide deliberately, not something to bolt on here.
- **e2e gotcha worth remembering:** the fixture images from `tests/e2e/png.ts`
  are gradients, not flat colors ("keeps the file realistic"). A test that
  wants to prove "this pixel is node A, not node B" cannot compare against a
  precomputed solid color - it has to sample the *same* screen point before
  and after the action and check the color changed, the same technique
  `moveResize.spec.ts` already uses. `tests/e2e/selectionActions.spec.ts`'s
  bring-to-front test got this wrong on the first pass (compared two
  different screen points to each other) and failed identically on all three
  engines - not flaky, just wrong math, which was the tell that it was a test
  bug and not a product bug.
- **Also worth remembering:** with two 400×300 fixture images in "Stacked"
  mode, each node spans the board's full content width, so there's no room
  to create an overlap by shifting sideways - it has to come from the
  vertical axis instead.

### Phase 2 item 7 — done: undo/redo

Shipped as its own commit (`ecdc42e`). Pushed and deployed to the live site.

- `board/store/boardStore.ts` gained `past`/`future: Board[]` and a single
  `commitBoard(s, board)` helper that every mutating action now routes
  through, replacing each action's own inline `set()`. Plain whole-`Board`
  snapshots, capped at 50 entries (`MAX_HISTORY`), exactly as the product
  plan's own 7.3 note prescribes - "ง่าย ถูกต้อง 100% ไม่ต้องทำ patch/inverse-op" -
  and as CLAUDE.md's item 7 line said not to build. `undo`/`redo` pop/push
  between `past`, `future` and `board`; any action committed after an undo
  clears `future` (the standard "a new action discards the redo branch"
  rule).
- **Real bug this surfaced, not just an e2e nuisance:** invariant 3 keeps
  pixels out of `Board`, but item 6's `AssetStore.retain()`/`release()` freed
  an image's `ImageBitmap` the instant its refcount hit zero - which used to
  be fine (a deleted node's asset had no other owner) but became actively
  wrong the moment undo history could still point at it. Deleting a node,
  then hitting undo, brought back a `Board` snapshot referencing an asset
  that had already been destroyed - undo would restore the node but not a
  working image. Fixed by replacing `retain`/`release` entirely with
  `AssetStore.reconcile(counts)`: `boardStore` computes assetId occurrence
  counts across `[board, ...past, ...future]` after every commit/undo/redo
  and reconcile only frees an asset once *no* reachable snapshot - past,
  present, or redo-future - references it anymore. `tests/e2e/undoRedo.spec.ts`
  ("undoing a delete brings back a real, still-decoded image") pins this down
  by sampling the same pixel before delete and after undo.
- **Second real bug, caught by the same e2e file:** the gap slider is a
  continuous control - every tick of a drag used to call `setGap` and would
  otherwise push 50+ history entries for one drag, blowing the whole undo
  budget on a single gesture (product plan 13.1 flags exactly this: "history:
  undo/redo, การรวม action ที่ต่อเนื่องกัน" - merge consecutive actions). Fixed
  with `beginAdjustment`/`endAdjustment`, wired to the slider's
  pointerdown/up *and* keydown/up (so an arrow-key nudge also commits as one
  step): `commitBoard` skips the history push entirely while an adjustment
  window is open and `endAdjustment` commits exactly one entry - the
  pre-gesture board - for the whole drag. Same "batch continuous input,
  commit once" shape as item 3's move/resize ref pattern, just at the store
  level instead of the canvas ref level.
- **Third real bug, only found because the e2e test held focus on the slider
  after dragging it (exactly what a real user does right before reaching for
  undo):** the existing keyboard-shortcut guard in `BoardCanvas.tsx` bailed
  out of *all* shortcuts whenever `e.target` was an `INPUT`/`TEXTAREA`/
  `SELECT`, so Ctrl/Cmd+Z silently did nothing while the gap slider had
  focus. Fixed by moving the undo/redo check ahead of that guard with its own
  narrower one (`isTextEntry` - bails only for a real text-editing surface:
  `TEXTAREA`, `SELECT`, or a non-range `INPUT`), so Ctrl/Cmd+Z keeps working
  with the slider focused but would still defer to a future caption
  textarea's own native undo (invariant 7). The plain single-key shortcuts
  (`+`/`-`/`0`/`1`/Delete/Escape) keep the original broad guard untouched -
  narrowing it further wasn't needed and wasn't in scope here.
- Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z is the one shortcut in this codebase that
  deliberately uses a modifier, unlike every other Phase 2 shortcut - see the
  existing "avoid shortcuts the browser owns" gotcha. It's safe specifically
  because no browser reserves plain Ctrl/Cmd+Z on a page the way it reserves
  Ctrl/Cmd+D (why item 6 deferred that one to item 9).
- **Scope cut:** no visible Undo/Redo button. There's no mockup for one, item
  9 owns "every action has a shortcut," and the standing mobile-overflow
  finding (see below) is a specific instruction not to add more to the top
  bar - keyboard-only is consistent with how item 1's zoom shortcuts and item
  6's Delete key both shipped ahead of any dedicated button too.
- `tests/unit/boardStore.test.ts` covers undo/redo (revert+redo, no-op at the
  ends, redo-branch discard, the 50-step cap, selection pruned to nodes that
  still exist after undo/redo) and the adjustment window (one entry per
  gesture, zero entries for a no-op gesture) all against fake assetIds, so
  the AssetStore interaction above is the e2e test's job specifically, not
  something the fast unit suite can see.

### Phase 2 item 8 — done: autosave to IndexedDB

Shipped as its own commit. Not yet pushed/deployed - see below.

- `src/board/persist/db.ts` - the only file that touches `indexedDB` directly.
  Two object stores: `board` (one record, key `"current"`) and `assets`
  (keyed by assetId). No library (`idb`, despite the product plan's 7.2 stack
  list naming it) - the codebase's own pattern for `AssetStore`/`TileCache`
  is a bespoke, well-tested wrapper around the platform API, and IndexedDB's
  surface here is small enough (get/put/delete/clear) that a library would
  just be another thing to trust instead of test.
- `src/board/persist/autosave.ts` - the actual autosave policy: an 800ms
  debounce (product plan 8.2) so a continuous gesture (the gap slider, a
  drag) doesn't write on every tick, plus a `knownAssetIds` diff cache that
  makes a save write only assetIds newly referenced or no longer referenced,
  never the unchanged ones - a direct analogue of `boardStore.reconcileAssets`
  (item 7), just targeting IndexedDB instead of `AssetStore`'s in-memory
  refcounts. `restoreAutosave()` returns null for "nothing saved" *and* for
  "saved but empty" - an empty board isn't a "recovered your work" moment.
- `boardStore.ts`'s `commitBoard` (item 7's single mutation choke point) now
  also calls `scheduleAutosave` - the same side-effect shape it already uses
  for `reconcileAssets`. `undo`/`redo` build their own return value instead
  of calling `commitBoard` (unchanged from item 7), so they call it directly;
  every other mutation goes through `commitBoard` and gets it for free.
- New store field `recoveredBoard` and actions `hydrate`/`dismissRecovery`/
  `startFresh`. `hydrate()` runs once from `App.tsx`'s mount effect, before
  the user can commit any action of their own (a later hydrate could clobber
  a real edit). It decodes each restored asset through the *existing*
  decode-worker pipeline via a new `AssetStore.restore(id, blob)` (same
  worker round-trip `ingest()` uses, but keyed by the *original* assetId
  instead of a fresh one, and bumping `AssetStore`'s and `boardStore`'s own
  id sequences past whatever it restores so a later `addFiles`/duplicate
  can't mint a colliding id). A node whose asset fails to decode is dropped
  rather than left rendering nothing forever.
- `RecoveryBar.tsx` - "Recovered your last board · [Start fresh]" per
  CLAUDE.md's exact wording, plus a dismiss (×). Dismissing keeps the
  restored board; only "Start fresh" empties it. "Start fresh" reuses the
  existing `clear()` shape (so it's undoable, same as the already-shipped
  "Clear board" button) but also calls `wipeAutosave()` directly - an
  explicit, deliberate "throw this away" action shouldn't wait out the 800ms
  debounce before it takes effect, the same reasoning invariant 4 applies to
  manual layout edits.
- **Real, engine-specific bug this surfaced:** headless WebKit's IndexedDB
  throws `UnknownError: Error preparing Blob/File data to be stored in
  object store` when a `Blob` is put into an object store directly - every
  restored node's asset silently failed to persist, so a reload always
  produced an *empty* recovered board (dropped by the "asset didn't decode"
  path above) even though the board record itself had saved fine. Fixed by
  storing assets as `{ id, data: ArrayBuffer, type, refs }` instead of
  `{ id, blob, refs }` - `db.ts` converts via `blob.arrayBuffer()` on the way
  in and `new Blob([data], { type })` on the way out, so every caller above
  it still deals only in `Blob`. Not reproduced on Chromium or Firefox; real
  Safari is unconfirmed either way - same shape as the existing WebKit
  rasterisation gotcha. Worth checking first if any *other* future feature
  needs to put a `Blob`/`File` directly into IndexedDB.
- Autosave is explicitly best-effort: `available()` no-ops the whole module
  when `indexedDB` doesn't exist (Safari private browsing), and `persist()`/
  `restoreAutosave()` swallow any storage error rather than throwing - this
  runs fire-and-forget from a `setTimeout`, so an uncaught rejection there
  would otherwise surface as an unhandled promise rejection with nothing
  visibly wrong on screen. Same "nice-to-have, not a hard dependency"
  treatment ADR-003 already gives `clipboard.write()`.
- `tests/unit/persist.test.ts` exercises `db.ts`/`autosave.ts` for real
  against `fake-indexeddb` (new devDependency - the product plan's own 13
  section names "fake IndexedDB" as the intended test strategy) - debounce
  timing, the add/delete asset diff, the shared-asset refcount, restore, and
  wipe. Real timers, not `vi.useFakeTimers()`: fake timers don't reliably
  interleave with fake-indexeddb's own internal scheduling (several tests
  hung indefinitely before this was found) - worth remembering before
  reaching for fake timers around *any* IndexedDB code, real or faked.
  `tests/unit/boardStore.test.ts` covers `hydrate`/`dismissRecovery`/
  `startFresh` against the plain-Node environment (no `fake-indexeddb`
  import), which exercises the `available()` no-op path specifically.
- **e2e gotcha worth remembering:** `page.waitForFunction(() => new
  Promise(...))` does not reliably await an in-page promise - it can accept
  the (always-truthy) Promise object itself as the poll result before it
  resolves, so a predicate that's "true once IndexedDB actually has the
  data" can pass instantly against stale/absent data. `tests/e2e/autosave.spec.ts`
  polls from the Node side instead (`expect.poll(() => page.evaluate(...))`),
  which round-trips per attempt and actually waits for the resolved value.

### Phase 2 item 9 — done: full keyboard shortcut set

Shipped as its own commit (`69cc234`). Pushed and deployed to the live site.

- **`Ctrl/Cmd+Shift+C` for copy** - the one shortcut the product plan names
  explicitly. Wiring it needed the design decision this item's own note
  flagged: `onCopy` and its "copied" button-state timer used to be local
  state inside `TopBar.tsx`, unreachable from `BoardCanvas.tsx`'s global
  keydown listener where every other shortcut lives. Fixed by extracting both
  into `src/hooks/useCopyAction.ts` (`useExportRender` - the 2x-scale render
  shared by copy and download; `useCopyAction` - the clipboard call plus the
  "copied" timer) and calling it once in `App.tsx`, the nearest common
  ancestor of `TopBar` and `BoardCanvas`, passing `copied`/`onCopy` down as
  props. One shared instance means the toolbar button and the shortcut show
  the exact same "Copied" feedback, not two independent timers.
- **Duplicate (`D`) and bring-to-front (`F`)** - item 6 flagged Ctrl/Cmd+D as
  browser-reserved (bookmarking, essentially everywhere) and left the actual
  key-binding decision to this item. Rather than chase down which modifier
  combinations are safe browser-by-browser, both got a **plain, no-modifier
  key** instead - the same pattern every Phase 2 shortcut but undo/redo
  already uses (zoom, Delete, Escape), which sidesteps the whole class of
  browser-reservation risk. Both still require a non-empty selection and
  bail out on a real text-entry target, same guard as Delete/Backspace.
- `BoardCanvas.tsx`'s `onKeyDown` now computes `isTextEntry` once per
  keydown (previously local to the undo/redo branch only) and reuses it for
  the new Ctrl/Cmd+Shift+C branch - same reasoning item 7 documented: the gap
  slider commonly still has focus right after a drag, the exact moment a
  user reaches for undo *or* copy, so a modifier shortcut must not be caught
  by the broader guard the plain shortcuts use.
- **Real, unverified risk carried forward, not fixed:** Chrome/Edge bind
  `Ctrl/Cmd+Shift+C` to DevTools' inspect-element mode as a browser-chrome
  accelerator, not a page-level one - `preventDefault()` in this app's
  keydown handler may not be enough to stop it on a real desktop build.
  Headless Playwright has no DevTools UI to observe this conflict either way.
  Same category as the existing "Not yet verified" real-browser items below -
  worth checking specifically the next time a human tests on real
  Chrome/Edge.
- Tooltips for Copy/Duplicate/Bring-to-front now show the key in parentheses
  (`toolbar.copyTitle`, `selection.duplicateTitle`, `selection.bringToFrontTitle`
  in `src/i18n/en.ts`) - `aria-label`/button text deliberately untouched so
  existing e2e selectors (`getByRole('button', { name: 'Duplicate' })` etc.)
  keep working.
- `tests/e2e/shortcuts.spec.ts` (new) covers all three: Ctrl+Shift+C copies a
  real PNG to the clipboard (skipped on headless Firefox/WebKit, same as
  `clipboard.spec.ts` - see ADR-003), `D` duplicates the selection and
  no-ops without one, `F` brings the selection to front - reusing
  `selectionActions.spec.ts`'s pixel-sampling technique since the fixture
  images are gradients, not flat colors.
- See [docs/phases/phase-2.md](docs/phases/phase-2.md) for the full Phase 2
  writeup and Definition of Done status.

## Live site status — up to date with Phase 3 (export options)

**https://snapboard.kaomatumaraiwa.com** — GitHub Pages, `gh-pages` branch,
HTTPS enforced, certificate approved. Source push (`git push origin
master:main`) and `bash scripts/deploy-pages.sh` were last run together right
after Phase 3's export-options commit (`1de8743`), and both worked cleanly
again on the first try (no re-auth, no DNS re-check needed). Live site now
serves all of Phase 2 (items 1–9), the Clear board addition, and Phase 3.
Deploy script itself reported success (`Published.` + the live URL); a
same-session `curl` for the new JS bundle hash still 404ed right after
(the page itself served a fresh `200` with today's `last-modified`), which
matches the documented CDN caveat below rather than a failed deploy — not
re-confirmed with a fresh 200 for the bundle itself, worth a quick check next
session if in doubt. (The custom domain sits behind a CDN edge cache with a
10-minute `max-age`, so a stale bundle hash can be observed for a few minutes
right after a deploy — not a deploy failure, just propagation.)

Both commands are one command away whenever there's new work to publish —
source: `git push origin master:main`; live site:
`bash scripts/deploy-pages.sh` (build → gh-pages orphan commit → Pages API,
idempotent). Neither runs automatically — they're outward-facing, so check
with the user first unless they've already said to just do it.

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

1. ✅ **Zoom, pan, zoom indicator, fit-to-view button.** Done — see the note
   under START HERE above for what shipped and one known follow-up
   (tile-cache thrash during a wheel-zoom gesture) to keep in mind for item 3.
2. ✅ **Selection** — click, shift-click, marquee. Done — see the note under
   START HERE above. Corner handles are drawn but not yet interactive; item 3
   wires them up.
3. ✅ **Move and resize** with snapping and alignment guides. Done — see the
   note under START HERE above, including a real ordering bug the e2e test
   caught (clearing the drag-override ref before the final draw).
4. ✅ **Switching to manual must be explicit.** Done — see the note under
   START HERE above. `setFrames` (item 3) flips `layout` to `'free'` and
   `TopBar` shows "Auto layout off · Turn back on".
5. ✅ **Drag to reorder** while still in an auto mode (step badges renumber).
   Done — see the note under START HERE above, including a real WebKit-only
   repaint bug it surfaced.
6. ✅ **Delete, duplicate, z-order.** Done — see the note under START HERE
   above, including the scope decision to ship exactly the three actions in
   the product plan's own mockup (no unused send-to-back/forward/backward),
   and an e2e gotcha about the fixture images being gradients, not flat
   colors.
7. ✅ **Undo/redo.** Done — see the note under START HERE above, including
   the asset-lifetime bug undo history surfaced in item 6's refcounting and
   the keyboard-guard bug the gap slider surfaced.
8. ✅ **Autosave to IndexedDB.** Done — see the note under START HERE above,
   including a real WebKit-only IndexedDB bug it surfaced (storing a `Blob`
   directly fails there; store bytes instead).
9. ✅ **Full keyboard shortcut set.** Done - see the note under START HERE
   above. `Ctrl/Cmd+Shift+C` copies (the one shortcut the product plan names
   explicitly), `D`/`F` duplicate/bring-to-front (plain keys, not a modifier,
   to sidestep the Ctrl/Cmd+D browser-reservation problem item 6 flagged).
   Real risk carried forward and not yet resolved: `Ctrl/Cmd+Shift+C` may
   lose to Chrome/Edge's DevTools inspect-element accelerator on a real
   desktop build - untestable in headless Playwright.

**Phase 2 is done when:** dragging 10 images holds 60fps · undo goes back 50
steps · closing and reopening the tab preserves the board · every action has a
shortcut · the Definition of Done in
[docs/00-product-plan.md](docs/00-product-plan.md) section 16 is fully met.
**All four are now true** - see
[docs/phases/phase-2.md](docs/phases/phase-2.md) for the Definition of Done
table; the two DoD items still open (real-browser manual testing on
Windows/Chrome and macOS/Safari; deploying this item to the live site) are
process gates, not missing features.

## Phase 3 — Export hardening

Objective: make the export path trustworthy - the user picks scale/format
and knows the output size before committing.

1. ✅ **Choose 1x/2x/3x, PNG/JPG + quality, see the output size before
   exporting.** Done — see the note under START HERE above. Turned out most
   of Phase 3's feature list (the canvas-size guard, transparent-background
   handling, meaningful filenames, clipboard fallback, the copy shortcut)
   already existed from Phase 1/2; this item was the one real gap, a
   `Download`/`▾` split button opening a small popover in `TopBar.tsx`.

**Phase 3 is done when:** export matches what's on screen 100% (pixel diff
< 0.1%) · a 15000px canvas doesn't crash · the Firefox fallback works
gracefully · pasting the exported file into Slack, LINE, Jira, Gmail, Word,
Figma, and Google Docs is confirmed with a results table. **The first three
are true** (see [docs/phases/phase-3.md](docs/phases/phase-3.md) for the
Definition of Done table); **the fourth needs a human with real accounts and
screens in those apps** — not doable from inside this environment.

## After Phase 3

Phase 4 annotations (arrow, box, text, number, redact, crop) · Phase 5
polish, dark mode, Thai UI · Phase 6 persistence and PWA · Phase 7 Chrome
extension. Full definitions in
[docs/00-product-plan.md](docs/00-product-plan.md) section 12.

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
- **The same async-rasterisation gap can leave stale pixels, not just a bad
  timestamp.** Found while building drag-to-reorder (Phase 2 item 5): headless
  WebKit can leave the preview canvas showing the pre-reorder frame for an
  unbounded stretch after two same-size cached tiles swap position in one
  redraw. Confirmed via direct tile/store inspection that the committed
  `Board` and the tiles themselves are correct immediately - only WebKit's
  own repaint lags. A `getImageData(0,0,1,1)` flush right after `renderScene()`
  in `BoardCanvas.tsx`'s `draw()` is cheap insurance but did not reliably fix
  it, so `tests/e2e/reorder.spec.ts`'s pixel-swap assertion skips on WebKit
  (`browserName === 'webkit'`) rather than retrying forever. Not reproduced on
  Chromium or Firefox; real Safari is unconfirmed either way.
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
- **Headless WebKit cannot `put()` a `Blob` directly into IndexedDB** - throws
  `UnknownError: Error preparing Blob/File data to be stored in object store`
  every time (Phase 2 item 8). Store `{ data: ArrayBuffer, type }` instead and
  reconstruct the `Blob` on read (`src/board/persist/db.ts`). Not reproduced
  on Chromium or Firefox; real Safari is unconfirmed either way.
- **`page.waitForFunction(() => new Promise(...))` does not reliably await an
  in-page promise** - it can accept the (always-truthy) pending Promise object
  itself as the poll result. Poll from the Node side instead:
  `expect.poll(() => page.evaluate(...))`, which round-trips per attempt and
  actually waits for the resolved value (`tests/e2e/autosave.spec.ts`).
- **Fake timers and `fake-indexeddb` don't reliably interleave.** `vi.useFakeTimers()`
  can leave IndexedDB requests never resolving (tests hang instead of failing).
  Use real, short waits around code that touches IndexedDB instead (see
  `tests/unit/persist.test.ts`).

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

1. Copy → paste into Slack, LINE, Jira, Gmail, Word, and (Phase 3 DoD, still
   open) inserting the downloaded PNG/JPG file into Figma and Google Docs too
   — as a results table, per [docs/phases/phase-3.md](docs/phases/phase-3.md).
2. Paste *from* Windows Snipping Tool and macOS Cmd+Shift+4.
3. Copy on real Safari and real Firefox (only Chromium is confirmed).

Checklist to work through:
[docs/manual-test-checklist.md](docs/manual-test-checklist.md).
Human Time-To-Copy (<20s target) has also not been measured with real people.
