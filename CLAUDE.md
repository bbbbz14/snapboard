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

**Manual-testing gap now closed** (2026-09-12, sections E and F of
[docs/manual-test-checklist.md](docs/manual-test-checklist.md) run against
the live site — see the Gate section below for the full results).

**Phase 4 (annotations) is underway. Items 1 (arrow), 2 (box/rectangle), 3
(text), and 4 (auto-numbered marker) are all done, pushed to `main`
(`cad4471`), and deployed to the live site.** **Next session should start
Phase 4 item 5** (redact) — see "Phase 4 — Annotations" below for the full
item list.
`npm run verify` green (typecheck + 198 unit + 27 renderer parity on 3
engines + 196 e2e passed, 5 skipped by design — same 5 as before, see the
note above; the marker e2e file added 5 test cases (15 counting all 3
browser engines) and no new skips).

### Phase 4 item 4 — done: auto-numbered marker annotation

Shipped as its own commit (`1e6578d`). Pushed to `main` and deployed to the
live site (`cad4471`, the CLAUDE.md follow-up commit, went out in the same
push+deploy).

- A floating "Number" tool button in the same bottom-left `AnnotationToolbar`
  (icon: `①`), plus a plain `N` keyboard shortcut - the simplest of the four
  Phase 4 tools shipped so far: a marker has no meaningful "size" to draw or
  content to type, just a place to point, so a single click on the canvas
  commits it immediately (on `pointerdown`, same as every other one-shot
  tool reverting to `'select'` the instant it commits). No drag-preview ref
  was needed on the interaction canvas either, unlike arrow/box - there's no
  in-progress gesture to preview.
- Deliberately named `MarkerNode`/`kind: 'marker'`/`tool: 'marker'`
  throughout the code, not "badge" - the codebase already uses "badge" for
  the unrelated per-image step-sequence number the `'steps'` auto-layout
  draws (`RenderItem.badge`/`drawBadge` in `renderScene.ts`, numbers images
  by layout position). This is a different concept: a node the user places
  by hand, anywhere, on top of anything. The user-facing label is "Number"
  (matching the product plan's own "ตัวเลขกำกับอัตโนมัติ" wording) - the
  naming split is deliberate: "marker" avoids an internal collision,
  "Number" is the plainer word for what the button visibly does.
- `BoardNode` is now `ImageNode | ArrowNode | BoxNode | TextNode |
  MarkerNode`. Like `BoxNode`/`TextNode`, `MarkerNode.frame` is not derived -
  it's a fixed-size square (`MARKER_DIAMETER` = 36 board px,
  `src/board/render/marker.ts`) centered on the point the user clicked, so
  every generic frame-based helper (`setFrames`'s move, `duplicateSelected`'s
  offset-copy, `hitTest`, `handles.ts`'s resize-handle exclusion) already did
  the right thing with zero new per-kind branches - the same reasoning
  box/text already established, and the smallest diff of the four for
  exactly that reason (no new store-level special case anywhere, unlike
  arrow's `setFrames`/`duplicateSelected` start/end translation).
- Numbering is **not** stored on the node - `toRenderInput` derives each
  marker's visible number from its placement order among markers only
  (`sorted.filter(kind === 'marker').map((n, i) => ({ ..., number: i + 1
  }))`), the exact same "index among same-kind nodes" rule the pre-existing
  per-image step badges already use one line above it in the same function.
  This means deleting a marker out of the middle renumbers the rest for
  free - there's no separate counter that could drift out of sync with the
  actual node list.
- `src/board/render/marker.ts` - `drawMarker`, a filled circle (the node's
  own `color`, shared `DEFAULT_ANNOTATION_COLOR` red, same as arrow/box/text)
  with a fixed white ring (not a background-matching one like the per-image
  step badge's ring - a marker sits on top of arbitrary image content, not
  next to it in the page background, so a background-matching ring would be
  the wrong contrast choice here) and a centered digit in the plain
  `ui-sans-serif` system-font stack - unlike text annotations, a marker's
  content is always a plain digit, so it has no need for the self-hosted
  Thai-capable `'Snapboard Annotation'` font pairing item 3 built. Called
  identically by `renderScene` (committed marker, board-space, invariant 1)
  and drawn from the same `frame`/`number`/`color` shape either way - no
  interaction-canvas preview variant exists because there's no drag to
  preview.
- Markers never expose a resize handle, for the same reason arrows/boxes
  don't - `handles.ts`'s existing `n.kind !== 'image'` guard already covers
  it, so this needed no new code. Dragging a marker's circle moves it
  instead, through the same generic `setFrames` path box/text already use
  (no arrow-style start/end to translate).
- `tests/unit/marker.test.ts` covers `markerFrame`'s centering directly.
  `tests/unit/boardStore.test.ts` gained an `addMarker` block mirroring
  `addBox`'s shape (centered frame from a point instead of two drag corners,
  free-layout switch, tool reverting to `'select'`, move/duplicate on the
  frame directly, exclusion from `toRenderInput.items`/step-badge numbering
  plus numbered presence in `.markers`, a renumber-after-delete case, and
  delete+undo). `tests/unit/hitTest.test.ts` gained one marker mixed-kind
  case. `tests/e2e/marker.spec.ts` (new) covers placing one (and export
  survival, invariant 1), the `N` shortcut arming/Escape-cancelling, placing
  two and deleting one (the actual renumbered-digit assertion is left to the
  unit suite - a pixel scan can tell a marker is present or gone but can't
  reliably read which digit is drawn), select→delete→undo, and that dragging
  the circle moves it (no resize handle).
- **Deliberately not done, scoped to what "a numbered marker" alone needs:**
  no manual renumbering or drag-to-reorder-the-sequence UI (numbering is
  pure placement order, full stop - same "don't add a decision nothing asked
  for yet" reasoning arrow's color-picker cut and box's no-fill cut already
  used), no size/color choice (shared `DEFAULT_ANNOTATION_COLOR`, same as
  every other annotation kind so far), no resize handle (move it, or delete
  and re-place it - same as arrow/box/text).

### Phase 4 item 3 — done: text annotation

Shipped as its own commit (`70ff0bc`). Pushed to `main` and deployed to the
live site. The user explicitly asked for a "premium" font that covers Thai
and English well, comparable to Apple's system font - not the default
`ui-sans-serif` stack the rest of the app's chrome uses.

- **Self-hosted font pairing, not a system-font stack:** `Inter` (Latin,
  weight 600) + `Anuphan` (Thai, weight 600 - drawn by Cadson Demak
  specifically to pair with Inter, sharing its x-height and modern
  grotesque feel) under one `@font-face` family, `'Snapboard Annotation'`,
  declared in `styles.css`. Both files are bundled in `src/assets/fonts/`
  (Vite processes them like any other imported asset, so `base: './'`
  keeps working under a subpath) - **not** fetched from Google Fonts at
  runtime, per the product plan's own 9.2 line ("ฟอนต์ self-host - ไม่งั้น
  IP ผู้ใช้รั่วไปหา Google") and invariant 6. `docs/licenses/OFL-*.txt` carry
  the OFL attribution for both. A system-font stack (`-apple-system` etc.)
  was rejected: it would render Latin as actual San Francisco on a Mac but
  something else entirely on Windows/Linux/Android, and worse, would depend
  on whatever (if anything) the visitor's OS ships for Thai - self-hosting
  one deliberately-chosen pairing gives every visitor the same premium,
  legible result regardless of OS, which is a stronger version of "premium"
  than merely matching one platform's default.
- **`tests/e2e/privacy.spec.ts` needed a real update, not a workaround:**
  the two font files load as soon as `BoardCanvas` mounts (see
  `ensureAnnotationFont` below), so they show up in that test's
  exact-request-list assertion even in a session that never places a
  single text/arrow node. This is expected and correct - same-origin,
  bundled, not a third-party request - so the fix was adding both URLs to
  the expected list, the same way `decode.worker.js` already sits there,
  not loosening the assertion.
- **Real, subtle bug caught only by a real headless-browser click, not by
  eye or by the unit suite:** a plain click's own default action is to shift
  focus to `document.body` once the click finishes dispatching (a `<canvas>`
  isn't focusable). Left alone, that default action fires *after* React has
  already inserted and auto-focused the new textarea overlay in response to
  the very same click's `pointerdown` (state flushes before the click's own
  trailing `pointerup`/`mouseup`/`click` land) - so the browser immediately
  blurred the textarea it had just focused, which triggered `onBlur` →
  `finishEditingText()` → committed (empty) text and closed the overlay,
  all within the same click. The symptom was "the text tool silently does
  nothing," reproducible on every engine, and invisible to `console.log`
  reasoning alone - only caught by instrumenting an actual Playwright click
  and reading the render log line by line. Fixed with one `e.preventDefault()`
  on the `pointerdown` in `BoardCanvas.tsx`'s `tool === 'text'` branch, which
  arrow/box never needed since neither creates a focusable element mid-
  gesture. Worth remembering for any future one-shot tool that also hands
  off focus to a new DOM element from inside a pointer handler.
- Mirrors arrow/box's one-shot placement shape where it can, but text's
  whole point is editable content, so it diverges in two ways neither arrow
  nor box needed: a `T` keyboard shortcut (free - checked against every
  other binding) plus a "Text" button in `AnnotationToolbar`, and a
  **textarea overlay for the actual typing**, per the product plan's own
  7.1 note ("DOM overlay ใช้เฉพาะ... textarea ตอนแก้ข้อความ... เหมือนที่
  Excalidraw ทำ") and invariant 7 (the overlay reads only `.value`, never
  becomes innerHTML). A single click (not a drag) places a fixed-width
  (`TEXT_DEFAULT_WIDTH`, 240 board px), one-line-tall draft and opens the
  overlay immediately; the tool reverts to `'select'` at that instant, same
  as arrow/box, well before the user has typed anything. Committing
  (blur, or the explicit Ctrl/Cmd+Enter shortcut) or cancelling (Escape) are
  both handled locally on the textarea's own `onKeyDown`/`onBlur` - the
  global `BoardCanvas` keydown handler already bails out for any real
  text-entry target (see item 7's `isTextEntry` note), so the two listeners
  never fight over the same keystroke.
- **Unlike arrow and box, text is re-editable** - double-clicking an
  existing text node (only while `tool === 'select'`) re-opens the same
  overlay, seeded with its current text/frame. This is a deliberate
  scope *addition* against the arrow/box precedent ("no post-hoc editing -
  delete and redraw"): for arrow/box that cut was about geometry, which
  isn't the point of either node, but text's content *is* the entire
  point, so being unable to fix a typo without delete-and-retype would be a
  much bigger everyday loss for this tool specifically.
- `src/board/render/text.ts` - `wrapText`, a pure line-wrap function (no
  `Ctx2D` dependency, just an injected `measure: (s: string) => number`, so
  it's directly unit-testable in Node - see `tests/unit/text.test.ts`) built
  on `Intl.Segmenter`, not `.split(' ')`. **Thai has no spaces between
  words** - a space-only wrapper would never break a long Thai sentence and
  it would run straight off the box. Word-granularity segmentation handles
  normal wrapping (works for Thai *and* English with no per-script branch);
  a grapheme-granularity fallback (`breakToWidth`) handles the rare
  over-wide single token (a long word or URL) *without* ever splitting a
  Thai base consonant from its own combining vowel/tone-mark codepoint,
  which a naive `[...str]` character-by-character break risks doing.
  `TextNode.frame.w` is fixed at creation (same "not resizable" scope cut as
  box); `frame.h` is the one field that isn't fixed - `wrapText` +
  `textHeight` recompute it from the real wrapped line count every time the
  node commits, using the exact same `ctx.measureText` the interactive
  overlay's live auto-grow only approximates (the overlay's own resize is
  just the browser's native textarea reflow, close enough for a live
  preview; only the committed `frame.h` needs to be exactly right, since
  that's what hit-testing/export/selection-outline all use afterwards).
- **`ensureAnnotationFont`** (`render/text.ts`) loads both font files via
  `document.fonts.load(...)` once, memoized. Canvas `fillText` has no
  `font-display` equivalent - a frame drawn before a face finishes loading
  silently falls back to a system font *forever*, with no automatic
  repaint once the real face becomes ready (unlike DOM text). Called eagerly
  in `BoardCanvas`'s mount effect (so a board restored from autosave that
  already has text nodes still gets the right font, not just a board where
  the user places new text after the fonts were already warm) with a
  `fontReady` state flip that forces exactly one extra redraw once loading
  finishes, and again in `exportBoard.ts` (awaited, since export is async
  and can't afford even that one wrong frame in a downloaded file).
- `BoardNode` is now `ImageNode | ArrowNode | BoxNode | TextNode`. Like
  `BoxNode`, `TextNode.frame` is not derived/padded - every generic
  frame-based helper (`setFrames`'s move, `duplicateSelected`'s offset-copy,
  `hitTest`, `handles.ts`'s resize-handle exclusion) already does the right
  thing with zero new per-kind branches, the same "box needed no new
  branches either" reasoning item 2 already established. The store's new
  `commitText(id, frame, text)` action deliberately takes an
  already-computed `frame` (not raw text + a callback) so `boardStore.ts`
  stays free of any canvas/DOM dependency, unlike geometry, text layout
  needs a real `measureText`, which only `BoardCanvas` (the caller) has;
  the store stays exactly as unit-testable in plain Node as it always was.
  Trimmed-empty text creates nothing (`id: null`) or deletes the node
  (`id` given) - the same "a stray click creates nothing" rule arrow/box
  use, extended to "an emptied-out text box doesn't linger as a blank
  annotation."
- `tests/unit/text.test.ts` covers `wrapText`/`textHeight` directly,
  including the no-spaces-in-Thai case, the combining-mark-safe grapheme
  fallback, and mixed Thai/English on one line. `tests/unit/boardStore.test.ts`
  gained a `commitText` block mirroring `addBox`'s (create, trimmed-empty
  no-ops, re-edit updates in place, re-edit-to-empty deletes, exclusion from
  `toRenderInput.items`/badge numbering plus presence in `.texts`, delete
  +undo). `tests/unit/hitTest.test.ts` gained one text mixed-kind case.
  `tests/e2e/text.spec.ts` (new) covers placing and typing Thai+English (and
  export survival, invariant 1), the `T` shortcut, Escape-cancels-a-fresh-
  placement, committing empty creates nothing, select→delete→undo, and the
  double-click-to-re-edit round trip (re-opening twice, to prove the first
  edit actually committed and wasn't just shown transiently) - using the
  same reddish-pixel-region scan technique `arrow.spec.ts`/`box.spec.ts`
  already established.
- **Deliberately not done, scoped to what "text" alone needs:** no font
  size/weight/color choice (still the shared `DEFAULT_ANNOTATION_COLOR` red,
  same "no decision nothing asked for yet" cut arrow/box already made), no
  resize handle (move the whole box, or delete and redraw - same as
  arrow/box), no rich text (bold/italic runs, bullet lists) - a plain
  wrapped label is everything the product plan's "ข้อความ" line item asks
  for. No auto-shrinking font to fit a fixed box either - height grows to
  fit the text instead, which is the same trade-off `TEXT_DEFAULT_WIDTH`'s
  "fixed width, grows down" already makes.

### Phase 4 item 1 — done: arrow annotation

Shipped as its own commit (`9a63829`). Pushed to `main` and deployed to the
live site (alongside items 2 and 3, in one combined push+deploy - `70ff0bc`).

- A floating "Arrow" tool button, bottom-left (mirrors `ZoomControls`'
  bottom-right placement), plus a plain `A` keyboard shortcut - press once to
  arm it, drag anywhere on the board to draw, release to commit. One-shot by
  design: committing an arrow (or a stray click with no drag) reverts the
  tool to `'select'` automatically, so there's no separate "done drawing"
  step. Escape while armed cancels back to `'select'` without creating
  anything.
- `BoardNode` (`src/board/model/types.ts`) is now a real discriminated union
  - `ImageNode | ArrowNode` - instead of the single-member alias it was
  through all of Phase 1–3. `ArrowNode` carries `start`/`end` (the actual
  drawn points) plus a `frame` that's a *derived*, padded bounding box, kept
  only so the existing generic code (`hitTest`, `marqueeSelect`, `moveToFront`
  - all already written in terms of `frame`/`order`/`id`, needed zero
  changes) keeps working on arrows exactly like it does on images.
- Every place that used to assume every node has an `assetId` needed an
  explicit filter to image nodes: `relayout` (arrows never participate in
  auto-layout - they're absolute board-space points the user placed, same
  as invariant 4 already treats a manually-moved image's frame),
  `reconcileAssets`, `decodeBoardAssets`, and autosave's `persist`/
  `restoreAutosave` (`src/board/persist/autosave.ts`). `toRenderInput` now
  filters to image nodes *before* numbering step badges, which incidentally
  fixes a latent bug this change would otherwise have introduced (badges
  would have started counting arrows as steps too).
- `src/board/render/arrow.ts` - pure geometry, no canvas-2D specifics beyond
  the actual `stroke()` calls: a single control point offset perpendicular to
  the line (so the arrow bows slightly - "โค้งเล็กน้อย ดูเป็นมิตร" per the
  product plan, not a rigid straight line), with the arrowhead angled off the
  curve's own tangent at the end point (direction from the control point to
  `end`), not the naive straight `start`-to-`end` line - the latter visibly
  points off the curve once it's bowed. `strokeArrow` is called identically
  by `renderScene` (the committed arrow, board-space, invariant 1) and
  `BoardCanvas`'s interaction-canvas preview (screen-space, while dragging),
  so the preview can't drift from what actually gets drawn - same "one
  source of truth" reasoning Phase 3's export-size estimate already used.
  `arrowFrame` is a padded AABB (not an exact curve hit-test) around the
  straight-line bounding box, wide enough to cover the bow and the
  arrowhead - plain rect math, same simplicity `hitTest.ts`'s "no rotation"
  comment already commits to for images.
- Arrows never expose a resize handle - `handles.ts`'s `hitTestHandle` now
  skips non-image nodes, and `BoardCanvas`'s selection-outline drawing skips
  the corner squares for them too, so the UI never advertises a drag
  interaction that doesn't exist. Dragging an arrow's outline moves it
  instead (the existing `moveRef`/`setFrames` path, unchanged) - `setFrames`
  and `duplicateSelected` both now special-case `kind === 'arrow'` to
  translate `start`/`end` by the same delta as the frame, since for an arrow
  (unlike an image) the frame alone isn't what gets rendered.
- **Real bug caught before it shipped, not by a test:** the board canvas's
  `aria-label` (`Board with {n} images`) used `board.nodes.length` directly -
  once arrows could share `board.nodes` with images, drawing one arrow would
  have made the label say "3 images" for a board with 2 images and 1 arrow.
  Fixed by counting only `kind === 'image'` nodes for that label
  specifically; `tests/e2e/selectionActions.spec.ts` and others that assert
  on this exact text would have caught it too, but not until they started
  mixing arrows into their own fixtures, which none of them do yet.
- `tests/unit/arrow.test.ts` covers the curve/arrowhead geometry and the
  padded frame directly. `tests/unit/boardStore.test.ts` gained an
  `addArrow` block covering the free-layout switch, the tool reverting to
  `'select'`, move/duplicate translating `start`/`end`, exclusion from
  `toRenderInput.items`/badge numbering, and delete+undo.
  `tests/unit/hitTest.test.ts` gained one mixed-kind case. `tests/e2e/arrow.spec.ts`
  (new) covers drawing (and that it survives export, invariant 1), the `A`
  shortcut, Escape-cancels-without-creating, a stray click creating nothing,
  and select→delete→undo - using a scan for the arrow's distinctive red
  against the white background/blue-gradient fixtures rather than sampling
  one exact pixel, since the curve's bow means the stroke isn't on the
  straight line between the two drag points.
- **Deliberately not done, scoped to what "arrow" alone needs:** no color
  picker (fixed `DEFAULT_ANNOTATION_COLOR`, `#dc2626`, later shared with item
  2's box - the remaining annotation types will need their own color
  decisions anyway, and picking one now for arrows alone would be exactly
  the kind of speculative surface CLAUDE.md says not to add). No
  endpoint-drag editing after the fact - move the whole arrow, or delete and
  redraw it; a full two-handle editing UI is real extra scope the product
  plan's own line item ("ลูกศร โค้งเล็กน้อย ดูเป็นมิตร") doesn't ask for.

### Phase 4 item 2 — done: box/rectangle annotation

Shipped as its own commit (`e122ee0`). Pushed to `main` and deployed to the
live site (alongside items 1 and 3, in one combined push+deploy - `70ff0bc`).

- Mirrors item 1's arrow tool exactly, down to the interaction shape: a
  floating "Box" tool button in the same bottom-left `AnnotationToolbar`
  (next to Arrow), plus a plain `R` keyboard shortcut (rectangle - `B` was
  free too, but every design tool this product's users already know uses
  `R`) - press once to arm it, drag anywhere on the board to draw, release
  to commit. One-shot by design, same as arrow: committing a box (or a stray
  click with no drag) reverts the tool to `'select'` automatically, and
  Escape while armed cancels without creating anything. `BoardCanvas.tsx`'s
  Escape handler is now `if (tool !== 'select') setTool('select')` instead
  of arrow-specific, so a future third one-shot tool won't need to touch it
  again.
- `BoardNode` is now `ImageNode | ArrowNode | BoxNode`. Unlike `ArrowNode`,
  `BoxNode.frame` is **not** a derived/padded box - it *is* the rectangle the
  user dragged, exactly like `ImageNode.frame`. That one difference means
  every generic frame-based helper (`setFrames`'s move, `duplicateSelected`'s
  offset-copy, `hitTest`) needed **zero** new per-kind branches - the
  existing `else` arm that already handles "not an arrow" (i.e. images)
  handles boxes correctly for free, since a box's frame-move and an image's
  frame-move are the identical operation. `relayout`, `reconcileAssets`, and
  `decodeBoardAssets`'s existing `n.kind !== 'image'`/`n.kind === 'image'`
  checks already generalize to any non-image kind, so none of those needed
  touching either - this item's diff is smaller than arrow's for exactly
  that reason.
- `src/board/render/box.ts` - `strokeBox`, a thin wrapper around
  `ctx.strokeRect` with `BOX_STROKE_WIDTH` (3, thinner than the arrow's 4
  since a box's outline runs along four long edges rather than one point-to-
  point line - a thick rectangle reads as a filled block at a glance).
  Called identically by `renderScene` (committed box, board-space,
  invariant 1) and `BoardCanvas`'s interaction-canvas preview (screen-space
  while dragging), same one-source-of-truth reasoning `strokeArrow` and
  Phase 3's export-size estimate already established. Drawn before arrows in
  `renderScene` so an arrow can still point across a box's outline without
  being interrupted by it.
- Renamed `DEFAULT_ARROW_COLOR` to `DEFAULT_ANNOTATION_COLOR` (still
  `#dc2626`) since both arrow and box need the same "auto color, red,
  visible on any background" default the product plan specifies once for
  all annotations, not per-kind - this avoids the same literal existing
  twice under two different names for what is definitionally one shared
  default.
- Boxes never expose a resize handle, same scope cut as arrows and for the
  same reason: `handles.ts`'s existing `n.kind !== 'image'` guard already
  excluded anything that isn't an image, so this needed no new code at all.
  Dragging a box's outline (or its interior - a box hit-tests as a plain
  AABB like every other node, so clicking inside it hits the box, not
  whatever image happens to sit underneath) moves the whole box instead.
- `tests/unit/boardStore.test.ts` gained an `addBox` block mirroring
  `addArrow`'s (frame from the two drag corners, normalized regardless of
  drag direction, free-layout switch, tool reverting to `'select'`,
  move/duplicate on the frame directly, exclusion from
  `toRenderInput.items`/badge numbering plus presence in `.boxes`, and
  delete+undo). `tests/unit/hitTest.test.ts` gained one box mixed-kind case
  next to arrow's. `tests/e2e/box.spec.ts` (new) covers drawing (and export
  survival, invariant 1), the `R` shortcut, Escape-cancels, a stray click
  creating nothing, select→delete→undo, and (one more than arrow's own
  spec, because unlike a curve a box's whole interior is a legitimate move
  handle) that dragging from inside the box's outline moves it rather than
  resizing anything - using the same reddish-pixel-region scan technique
  `arrow.spec.ts` established, since a stroked rectangle's edges aren't one
  exact pixel either.
- **Deliberately not done, scoped to what "box" alone needs:** no fill
  option (outline only, matching the product plan's own "กล่องกรอบ" -
  a frame, not a filled highlight) and no corner-radius/style choice - same
  "don't add a decision nothing asked for yet" reasoning arrow's color
  picker cut already used. No post-hoc resize, for the same reason arrow
  has none: move the whole box, or delete and redraw it.

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

Shipped as its own commit. Pushed to `main` and deployed to the live site,
along with the rest of Phase 2 (see "Current state" above) - this note
predates that push and was never corrected until now.

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

## Live site status — up to date with Phase 4 items 1–4 (arrow, box, text, marker)

**https://snapboard.kaomatumaraiwa.com** — GitHub Pages, `gh-pages` branch,
HTTPS enforced, certificate approved. Source push (`git push origin
master:main`) and `bash scripts/deploy-pages.sh` were last run together right
after Phase 4 item 4's auto-numbered-marker commit (`1e6578d`, plus its
CLAUDE.md follow-up `cad4471`), and both worked cleanly again on the first
try (no re-auth, no DNS re-check needed). Live site now serves all of Phase 2
(items 1–9), the Clear board addition, Phase 3, and Phase 4 items 1–4. Deploy
script itself reported success (`Published.` + the live URL); a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`. (The
custom domain sits behind a CDN edge cache with a 10-minute `max-age`, so a
stale bundle hash can be observed for a few minutes right after a deploy —
not a deploy failure, just propagation - worth a re-check next session if in
doubt about the *bundle* specifically, as opposed to the page.)

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

## ✅ Gate cleared — manual test checklist run on desktop (sections A–E; F skipped by choice)

The user ran [docs/manual-test-checklist.md](docs/manual-test-checklist.md)
against the live URL. **Sections A–D passed, including A (clipboard)** — the
thing that would have reordered Phase 2 if it had failed. It didn't, so the
planned order below stands.

**Section E (robustness/edge cases), run 2026-09-12 against the live site:**

- **E1** (drop 20+ images at once) — pass, no hang, progress showed.
- **E2** (HEIC file from iPhone) — skipped, user had no HEIC file on hand.
  Still formally unverified.
- **E3** (corrupted file, `.txt` renamed to `.png`) — pass, rejected with a
  clear "not supported" message.
- **E4** (file over 50MB) — skipped, same reason as E2. Still formally
  unverified.
- **E5** (mash the Copy button repeatedly, tens of times) — pass, no crash.
- **E6** (resize/zoom the browser window) — investigated as part of this
  report, not a bug: **browser-native zoom (Ctrl/Cmd +/-) and window resize
  scale the whole page, top bar included** — that's how every website
  behaves under browser zoom; `TopBar.tsx`'s CSS is plain px/em with nothing
  viewport-relative (confirmed by grep), so there's no app-side scaling logic
  to blame. The app's *own* zoom (the bottom-right +/- controls from item 1)
  correctly zooms only the board canvas and leaves the top bar untouched,
  which the user separately confirmed works fine. Pass — worth remembering
  this distinction if "the UI resizes when I zoom" comes up again; that's
  the browser's job, not this app's.
- **E7** (OS set to dark mode) — pass, UI chrome follows the OS theme, board
  background does not change (correct — the board background is export
  content, not UI).
- **E8** (close tab, reopen) — pass, the board comes back via
  `RecoveryBar`/autosave (item 8). This supersedes the pre-Phase-2 version of
  this checklist item, which expected work to be lost.
- **Section F (privacy: Network tab, offline reload)** — user chose to skip
  both; not planned to revisit unless something else prompts it.
- **Manual-testing gap is now closed** to the scope the user wants covered.
  E2/E4 remain formally unverified (no test file was available, not that they
  failed) and real Safari/Firefox/non-Chromium mobile are still unconfirmed
  one by one (see "Not yet verified" below) — neither blocks starting Phase 4.
- **New finding, desktop-only testing so far:** on mobile, the top bar/toolbar
  requires horizontal scrolling to reach — awkward to use. Not filed as a
  Phase 2 item (user wants it noted, not built now); revisit when doing
  mobile-specific work, likely alongside or after Phase 5 polish. Keep this in
  mind if any Phase 2 UI (zoom controls, selection handles) adds more to that
  bar — it makes the overflow worse, not better.
- Real Safari/Firefox and non-Chromium mobile browsers still haven't been
  explicitly confirmed one by one — if that level of detail matters before
  Phase 4, ask the user which browsers they actually used.

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

## Phase 4 — Annotations

Objective: move from "arranging screenshots" to "explaining them" - per the
product plan's own framing, "เปลี่ยนจาก 'ต่อรูป' เป็น 'อธิบาย'." Build in this
order; each item is independently shippable, same as Phase 2/3.

1. ✅ **Arrow** (gently curved, friendly, not a rigid straight line). Done —
   see "Phase 4 item 1" under START HERE above.
2. ✅ **Box/rectangle** outline to frame a region of interest. Done — see
   "Phase 4 item 2" under START HERE above.
3. ✅ **Text** - done — see "Phase 4 item 3" under START HERE above.
4. ✅ **Auto-numbered marker** - done — see "Phase 4 item 4" under START HERE
   above. Named `MarkerNode`/`'marker'` (user-facing label "Number"), not
   "badge", to avoid confusion with the unrelated per-image step-sequence
   badge `'steps'` layout already draws (`BADGE_DIAMETER`/`drawBadge` in
   `renderScene.ts`).
5. ⬜ **Redact** (blur/pixelate/solid fill) over a region - the product
   plan's own risk note applies here: a light blur can be reversible, so a
   safe minimum pixelation strength should be enforced, and "solid" should be
   the suggested default for genuinely sensitive content.
6. ⬜ **Crop** the board itself.

**Phase 4 is done when:** placing an arrow + number on a bug report takes
under 15 seconds · redacted content is verifiably unrecoverable from the
exported file (tested by zooming into the export, not just eyeballing the
preview) · the product plan's own Definition of Done (section 12) is met.

## After Phase 4

Phase 5 polish, dark mode, Thai UI · Phase 6 persistence and PWA · Phase 7
Chrome extension. Full definitions in
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
- **A click's own default action can steal focus back from something that
  click just created.** Found building the text tool (Phase 4 item 3): a
  plain mousedown's default action shifts focus to `document.body` once the
  click finishes dispatching, since a bare `<canvas>` isn't focusable. If a
  `pointerdown` handler on that canvas reacts by inserting and auto-focusing
  a new DOM element (a textarea, say) in response to the *same* click,
  React flushes that before the click's own trailing `pointerup`/`mouseup`/
  `click` land - so the browser's still-pending default action blurs the
  element it was just given, one click after it was focused. Symptom: the
  new element appears to work, then instantly closes/commits itself, on
  every engine, invisible to reasoning alone (only caught by logging the
  actual render sequence around a real Playwright click). Fix: call
  `e.preventDefault()` on that `pointerdown` before handing off focus. Worth
  checking first for any future tool that also creates a focusable element
  from inside a pointer handler.
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
