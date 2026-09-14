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

**Phase 4 (annotations) is now complete - all 6 items done, pushed to
`main`, and deployed to the live site.** Items 1 (arrow), 2 (box/rectangle),
3 (text), and 4 (auto-numbered marker) were already pushed (`cad4471`) and
deployed before this session. **Item 5 (redact, solid fill only) and item 6
(crop, per-image) were both built and shipped in this session, in one
combined commit (`1276962`), push, and deploy** - item 5 had been sitting
done-but-uncommitted since the prior session; the user explicitly approved
building item 6 first and then committing, pushing, and deploying both
together in one pass, exactly as described here. Push and deploy both
worked cleanly on the first try (no re-auth, no DNS re-check needed); a
same-session `curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh
`200`. See "Phase 4 item 5" and "Phase 4 item 6" below for what each one
built, and [docs/phases/phase-4.md](docs/phases/phase-4.md) for the full
Phase 4 writeup and Definition of Done table. `npm run verify` green
(typecheck + 218 unit + 27 renderer parity on 3 engines + 234 e2e - 229
passed, 5 skipped by design - same 5 as always, see the note above; item 6's
e2e file added 5 test cases (15 counting all 3 browser engines) and no new
skips).

**Phase 5 (polish) is in progress. Item 1 (design system cleanup) is done,
shipped (`132126d`), pushed to `main`, and deployed to the live site** -
see "Phase 5 item 1" below for the full writeup.

**Item 2 (dark mode) is also done - built this session as the verification
pass item 1 set it up to be, plus one real bug the pass found and fixed -
shipped (`87fd9df`), pushed to `main`, and deployed to the live site.**
`npm run verify` green (typecheck + 218 unit + 27 renderer parity on 3
engines + 234 e2e - 229 passed, 5 skipped by design, same 5 as always).
Push and deploy both worked cleanly on the first try; a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`. See
"Phase 5 item 2" below for the full writeup, including one deferred finding
for item 5 (the text-edit overlay's contrast).

**Item 3 (minimum top-bar overflow fix) is also done**, shipped as commit
`aebdbd2` (recorded in `57459f5`), and as of this session (2026-09-13) has
also been **pushed to `main` and deployed to the live site** - the push and
deploy were held over from the prior session per the user's "commit first,
continue next session" instruction, and this session's first action, on the
user's approval, was to run both. Push and deploy both worked cleanly on the
first try; a same-session `curl -o /dev/null -w '%{http_code}'` for `/`
returned a fresh `200`. It went out bundled with a batch of real-usage
feedback fixes found by the user actually using the live site (not part of
the planned Phase 5 list) - see "Phase 5 item 3" below for the full writeup
of both. `npm run verify` green (typecheck + 218 unit + 27 renderer parity
on 3 engines + 229/234 e2e passed, 5 skipped by design, same 5 as always).

**A 3-part revision to the five Phase 4 annotation tools**
(arrow/box/text/marker/redact) is now complete - all 3 parts done, pushed
to `main`, and deployed to the live site. It reopened scope every one of
those items deliberately cut at the time ("no color picker," "no size
choice" - see each item's own note below) because nothing had asked for it
yet. Something did: the user tested the live site and wanted Lightshot-style
controls. Was explicitly sequenced so the two text-only parts wouldn't
collide with each other mid-flight:

1. ✅ **Done - size (thickness) + color for every annotation tool, adjusted
   by scrolling the mouse wheel while a tool is armed.** Built this session,
   shipped as commit `26c6761`, pushed to `main`, and deployed to the live
   site. See "Phase 5 annotation revision, part 1" below for the full
   writeup.
2. ✅ **Done - a halo (light outline) behind text-tool glyphs for
   legibility.** Built this session, shipped as commit `b6f1d5c`, pushed to
   `main`, and deployed to the live site. Three OFL font pairings and two
   treatments were compared live before deciding to **keep the current
   Inter+Anuphan pairing and add only the halo treatment** - see "Phase 5
   annotation revision, part 2" below for the full writeup, including a
   real gap this found in the render-parity test harness itself.
3. ✅ **Done - text box starts small and grows (and shrinks) with the
   content, instead of a fixed 240px width that only grew taller.** Built
   this session, shipped as commit `1dc665d`, **pushed to `main` and
   deployed to the live site** (recorded in `42828bc`, on the user's
   approval). Push and deploy both worked cleanly on the first try; the
   `gh-pages` branch's own last commit reads `Deploy 42828bc` (confirmed via
   `git fetch origin gh-pages` + `git log`) and a same-session
   `curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`.
   `npm run verify` green (typecheck + 243 unit + 27 renderer parity on 3
   engines + 256/261 e2e passed, 5 skipped by design, same 5 as always -
   this part added 6 new unit cases for `textAutoWidth`, no new e2e cases
   needed since `text.spec.ts`/`annotationEdit.spec.ts` already exercise the
   same code paths and kept passing unchanged). See "Phase 5 annotation
   revision, part 3" below for the full writeup.

**This closes all 3 parts of the annotation-revision arc** (size+color per
tool, the text shadow treatment, and now content-driven text sizing) - the
arc opened earlier in this guide is fully shipped and live. Live site is
now up to date with everything through this arc; see "Live site status"
below, which has also been updated to say so.

**Two real bugs in part 1's own UI, found this session by the user actually
using the wheel/color feature on the live site and fixed before starting
part 2** - both shipped in the same commit as part 2, `b6f1d5c`: the
Style/settings button disabled itself the instant an annotation tool
committed and reverted to `'select'` (i.e. right after drawing one shape,
since every annotation tool is one-shot), which broke the single most
common real flow - arm a tool, draw with it, then try to change its
color/size - and looked exactly like "the color button doesn't work." Fixed
by remembering the last-armed tool so settings stay reachable across that
revert. Separately, scrolling the wheel to adjust size had no feedback at
all unless the popover happened to already be open - fixed with a small
transient "Npx" badge near the toolbar. See "Phase 5 annotation revision,
part 2" below for the full writeup of both, plus the halo work.

**Phase 5 item 4 (6 gradient backgrounds) is now built, verified, pushed to
`main`, and deployed to the live site**, shipped as commits `a8007b5`
(feature) and `0bd757a` (this Guide) - held un-pushed for one session per
the user's explicit instruction (2026-09-13) to update this Guide and
continue in a fresh session, the same pattern item 3 used earlier in this
same phase, then pushed and deployed in the next session **together with
the "third round of real-usage feedback" bug fixes below**, on the user's
approval, in one combined push+deploy pass. Push and deploy both worked
cleanly on the first try; see "Live site status" below for the confirmation
details (shared with the bug-fix round, since they went out together).
`npm run verify` green (typecheck + 243 unit + 33 renderer parity on 3
engines - 11 scenes now, up from 10, the new one is a plain-style gradient
scene added specifically for this item - + 256/261 e2e passed, 5 skipped by
design, same 5 as always). See "Phase 5 item 4" below for the full writeup,
including two real bugs this item's own new tests caught in themselves (not
in the app) before it was declared done.

Still open and still needing the user: the Slack/LINE/Jira/Gmail/Word/Figma/
Google Docs paste results table. Not doable from inside this environment.

**Third round of real-usage feedback (2026-09-13) - three bugs found, fixed,
and verified this session, shipped as commit `baaa915`, pushed to `main`
together with Phase 5 item 4 (gradient backgrounds, above - both went out in
the same push+deploy pass, on the user's explicit approval), and deployed
to the live site.** Push and deploy both worked cleanly on the first try;
the `gh-pages` branch's own last commit reads `Deploy baaa915` (confirmed
via `git fetch origin gh-pages` + `git log`) and a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`. All
three bugs were in flows the user actually used on the live site, not
caught by any existing test - each fix below shipped with a new regression
test that reproduces the bug against the pre-fix code first (confirmed to
fail), then passes against the fix.

1. **The "Edit style" color/size popover opened far away from the button
   that opened it, instead of attached to it.** Root cause confirmed by
   reading the CSS, not guessed: `.selection-toolbar` (`src/app/styles.css`)
   is positioned with `transform: translate(-50%, calc(-100% - 10px))` to
   center itself above the selection. A CSS `transform` on an ancestor
   creates a new containing block for any `position: fixed` descendant - the
   same class of bug the `ExportMenu`/`.topbar` gotcha already documents
   (Phase 5 item 3's note), just via `transform` instead of `overflow`.
   `AnnotationSettingsPopover` was a plain DOM child of `.selection-toolbar`
   and computed its `position: fixed` coordinates from `window.innerHeight`/
   `getBoundingClientRect()`, assuming they're viewport-relative - inside a
   transformed ancestor they weren't, so the popover landed nowhere near the
   button. Specific to the `SelectionToolbar` path - `AnnotationToolbar`'s
   own settings button (bottom-left, no `transform` on its container)
   already positioned correctly, which is exactly why part 1's original
   `annotationSettings.spec.ts` e2e suite never caught this: it only
   exercises the still-armed-tool flow, not the edit-existing-node one.
   **Fixed** by rendering `AnnotationSettingsPopover` through a React portal
   to `document.body`, so it's no longer a descendant of whatever transform
   its anchor's ancestor happens to have. Confirmed live (a throwaway
   Playwright script, not committed): the popover now sits pixel-aligned
   with the button's left edge, 6px above it. New e2e case in
   `tests/e2e/annotationEdit.spec.ts` asserts the popover's bounding box is
   within 20px of the button, not just that it exists in the DOM.
2. **Dragging the size slider on an already-placed node felt
   flickery/laggy, "like it's broken."** Root cause confirmed by reading
   `boardStore.ts`: `setNodeColor`, `setNodeSize`, and the re-edit branch of
   `commitText` all called `commitBoard` directly on every single
   invocation - unlike the gap slider, which was explicitly wrapped in
   `beginAdjustment`/`endAdjustment` back in Phase 2 item 7 specifically to
   stop a continuous drag from pushing dozens of undo-history entries and
   doing a full commit on every tick. That batching was never applied when
   `setNodeColor`/`setNodeSize`/`commitText`'s size parameter were added in
   "real-usage feedback round 2" - so every 'input' event while dragging the
   size slider (many per second) did a full board commit, history push, and
   asset reconcile, the same per-tick cost item 7's own note already
   identified as the problem. **Fixed** by threading two new optional
   `AnnotationSettingsPopover` props, `onAdjustStart`/`onAdjustEnd`, wired
   to the size `<input>`'s pointerdown/keydown → pointerup/keyup - the exact
   same four-event pattern `TopBar`'s gap slider already uses - and only
   passed by `SelectionToolbar` (whose `onSizeChange` mutates `Board`
   state). `AnnotationToolbar`'s own use of the same popover only ever
   changes `toolSettings` (never routed through undo history to begin with),
   so it leaves them unset. Confirmed live: a 10-step slider drag now
   collapses into exactly one undo step. New e2e case in
   `annotationEdit.spec.ts` mirrors `undoRedo.spec.ts`'s existing gap-slider
   test structure for this.
3. **The text tool's live-editing box would drop a word to a second line
   while typing, well before the box's content-driven width (Phase 5
   annotation revision part 3) should have needed to wrap at all.** Root
   cause confirmed by reading the CSS and reproducing it: `.text-edit` is
   `box-sizing: border-box` with a 1px border on each side, but
   `textAutoWidth` (the function that sizes the overlay) only ever reserved
   room for the padding, not the border - so the overlay's real content area
   was 2px narrower than what `ctx.measureText` had just calculated as an
   *exact* fit with zero spare margin. That 2px was enough for the browser's
   own text layout to wrap the last character to a new line on almost any
   line close to its fitted width - which, while actively typing, is most
   lines. **Fixed** by adding `TEXT_EDIT_BORDER_PX` (`BoardCanvas.tsx`) and
   inflating only the overlay's own CSS width by `2 * TEXT_EDIT_BORDER_PX` -
   never `editingText.width` itself, which stays exactly `textAutoWidth`'s
   result since that's also the committed node's real `frame.w` (export/
   hit-testing/undo all use it, and the committed render has no border to
   account for in the first place). Confirmed by reproducing the bug against
   the pre-fix code first (a growing single line jumped to a second line
   after only 2-3 characters) and then confirming zero such jumps post-fix
   across a full test sentence, both via a throwaway Playwright script and
   the new committed case in `tests/e2e/text.spec.ts` ("typing a growing
   single line does not wrap early, before the box reaches
   TEXT_MAX_WIDTH").
4. The user's separate description of needing to "click through the color
   button again" to reach resize was a symptom of bug 1, not a fourth bug -
   once the popover renders in the wrong place, a click aimed at the
   (invisible-to-the-user) real slider location can miss and hit the canvas
   instead, forcing a re-open. No separate fix was needed for it once bug 1
   was fixed.

`npm run verify` green (typecheck + 243 unit + 33 renderer parity on 3
engines + 265/270 e2e passed, 5 skipped by design, same 5 as always - this
round added 3 new e2e cases × 3 engines = 9, all green on the first full run
after the fixes).

**Decided this session (2026-09-13), no longer open - do not raise these
again:** real Safari/Firefox confirmation and manual-checklist E2 (HEIC) /
E4 (>50MB) are explicitly skipped by the user. `Ctrl/Cmd+Shift+C` vs
Chrome/Edge DevTools is no longer an open question either - the user
confirmed on a real desktop build that DevTools wins, so this is now a known,
accepted limitation (see Phase 2 item 9's note and the shortcut cheatsheet,
Phase 5 item 8), not a thing to test or fix.

**A second round of real-usage feedback (2026-09-13, later the same day) -
four things fixed/shipped in one combined commit (`2950020`), pushed to
`main`, and deployed to the live site.** Push and deploy both worked cleanly
on the first try; the `gh-pages` branch's own last commit reads
`Deploy 2950020` (confirmed via `git fetch origin gh-pages` + `git log`) and
a same-session `curl -o /dev/null -w '%{http_code}'` for `/` returned a
fresh `200` - the served bundle hash hadn't rolled over yet at that exact
moment, same CDN-cache caveat as always (see "Live site status" below), not
a deploy failure. `npm run verify` green (typecheck + 237 unit + 27
renderer parity on 3 engines + 261 e2e - 256 passed, 5 skipped by design,
same 5 as always - this round added 5 new unit cases plus a new
`tests/e2e/annotationEdit.spec.ts` with 3 cases × 3 engines = 9, all green
on the first full run after fixing the issues described below). See
"Real-usage feedback round 2" below for the full writeup of all four items
and the two real test-suite bugs this round's own e2e coverage surfaced.

- **Board auto-fit to content** - closes the exact bug reported: rearranging
  a taller multi-row auto-layout into one shorter row by hand used to leave
  the old, larger canvas behind as dead margin in every export/copy, because
  `board.size` was frozen the instant the board left auto mode (invariant 4
  only ever protected frames, not size). `setFrames` now re-fits `board.size`
  to the content's own bounding box + padding on every manual move/resize.
- **Auto-layout `rows` mode no longer depends on file order** - dropping
  files and picking them via "Choose files" could produce a different,
  worse arrangement for the *identical* set of images, because the OS gives
  each path a different file order and the old greedy row-packer had no
  look-ahead. It now sorts a copy by aspect ratio before packing.
- **Already-placed annotations can now be recolored/resized without being
  deleted and redrawn** - a new "Edit style" button in `SelectionToolbar`,
  shown for a single selected arrow/box/text/marker/redact, opens the same
  popover `AnnotationToolbar` uses but edits that node directly.
- **Text's white halo (part 2, right above) was replaced with a soft
  drop-shadow** - live-compared against real screenshot content, not just
  the synthetic gradient backdrop the halo itself was chosen on, and judged
  "cheap-looking" - see "Real-usage feedback round 2" for the comparison
  method and the exact values chosen.
- **Investigated and closed, not a bug:** the deployed Thai text looked
  like a generic system font with no "hua" (the loop Thai consonants
  traditionally carry) instead of the premium Inter+Anuphan pairing - a
  pixel-diff check (see below) proved it *is* Anuphan, loading and applying
  correctly; Anuphan's own type design is simply a modern, loopless one.
  Not to be re-raised as a font-loading bug.

**Phase 5 item 5 (accessibility pass) is now built, verified, pushed to
`main`, and deployed to the live site** (commit `2d3f789`), on the user's
approval. Push and deploy both worked cleanly on the first try; the
`gh-pages` branch's own last commit reads `Deploy 2d3f789` (confirmed via
`git fetch origin gh-pages` + `git log`) and a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`. All 4
concrete gaps item 1/2's audits found and deliberately deferred are closed
this session: a new shared hook
(`src/hooks/useFocusTrap.ts`) gives all three anchored popovers
(`ExportMenu`, `BackgroundMenu`, `AnnotationSettingsPopover` - not just
`ExportMenu`, which is the one the audit named, but all three share the
identical pattern and therefore the identical gap) a real focus trap, focus
moved in on open, and focus restored to the button that opened them on
close; `TopBar`'s Layout/Style chip groups (and `ExportMenu`'s
Format/Scale groups, found to have the same gap while fixing the named
one) gained `role="group"` next to their existing `aria-label` - a plain
`<div>` has no implicit role, so `aria-label` alone is commonly dropped by
screen readers; the gap/quality/annotation-size sliders gained explicit
`htmlFor`/`id` pairing instead of relying only on implicit label-wrapping;
and `.text-edit`'s background changed from a 70%-translucent `--surface`
(real contrast depended on whatever image content sits underneath -
measured as low as 2.64:1 dark / 3.20:1 light, both failing AA) to a new
fixed, opaque `--text-edit-bg` token (`#ffffff`, deliberately outside the
dark-mode block like every other board-content token) chosen to guarantee
>=4.5:1 against the also-fixed `--annotation` red regardless of theme or
underlying content - confirmed at exactly 4.83:1 in both themes via a real
`getComputedStyle`+relative-luminance probe, not just computed on paper.
A real bug in this session's own new code was caught and fixed before
declaring it done: the initial "move focus into the popover" call raced
against the popover's own `visibility:hidden`-until-positioned render and
the browser's default focus-on-click behavior, so focus silently failed to
move on the very first attempt - fixed by deferring that call to a
`requestAnimationFrame`. All of this was verified live via a throwaway
Playwright script (not committed): focus enters each popover on open, Tab
never escapes any of the three, focus returns to the triggering button on
Escape, and the `.text-edit` contrast reads 4.83:1 in both a light- and a
dark-color-scheme browser context. **Lighthouse itself is not installed in
this environment**, so the Phase 5-level "a11y > 95" target is closed only
as "these 4 named gaps are fixed and verified by other means," not by that
specific tool - worth a real Lighthouse run on a real machine if that exact
number is ever needed. No new automated test was added - same call item
2's dark-mode verification pass made for its own no-new-test fixes: these
are DOM/CSS-level accessibility properties existing e2e specs were never
asserting on either way, so nothing regressed and nothing new needed
covering by the suite itself. `npm run verify` green (typecheck + 243 unit
+ 33 renderer parity on 3 engines + 265/270 e2e passed, 5 skipped by
design, same 5 as always - unchanged counts, confirming nothing else moved).
See "Phase 5 item 5" below for the full writeup.

**Phase 5 item 11 (mobile lite mode) is now done, pushed to `main`, and
deployed to the live site** (commit `84d0383`), on the user's approval, in
the same session it was built. Per the product plan's own §4.6 ("บนมือถือ:
แสดงโหมด lite = เลือกรูป → เลือกโหมดจัดวาง → บันทึกภาพ (ไม่มีการย้ายอิสระ)") -
narrower scope than this Guide's own earlier framing of the item suggested,
see "Phase 5 item 11" below for why - below a ~700px viewport `BoardCanvas`
now renders non-interactively (no drag/resize/annotate/crop/zoom/pan, no
per-node toolbars); the existing `TopBar` (layout/style/gap/background/
export controls), already tested and already scrolling correctly per item
3, is unchanged and *is* the entire "pick a layout mode -> save" flow the
plan asks for. `npm run verify` green (typecheck + 243 unit + 33 renderer
parity on 3 engines + 312 e2e - 307 passed, 5 skipped by design, same 5 as
always - this item added a new `tests/e2e/mobileLite.spec.ts` with 3 cases
x 3 engines = 9, all green on the first full run). Push and deploy both
worked cleanly on the first try; the `gh-pages` branch's own last commit
reads `Deploy 84d0383` (confirmed via `git fetch origin gh-pages` +
`git log`) and a same-session `curl -o /dev/null -w '%{http_code}'` for `/`
returned a fresh `200`. Item 10 (i18n) is cancelled by explicit user
decision the same session (2026-09-14), not pending. **This closes every
item in Phase 5's own list (1-9 done earlier, 10 cancelled, 11 now done) -
Phase 5 is functionally complete**, pending only the product-plan-level
Definition of Done items that need real people (Time-To-Copy, Lighthouse
a11y > 95 on a real machine) and the still-open Slack/LINE/Jira/Gmail/Word/
Figma/Google Docs paste results table noted earlier. See "Phase 5 item 11"
below for the full writeup, [docs/phases/phase-5.md](docs/phases/phase-5.md)
for the full Phase 5 Definition of Done table, and "Live site status"
further down, updated to include this item.

**A mobile UX revision, driven by real-usage feedback on the live site, is
now built, verified, pushed to `main`, and deployed to the live site**
(commit `c02fa3b`), on the user's approval. The user found item 11's own
top-bar horizontal-scroll fallback (item 3) unpleasant on a phone ("ต้อง
คอยเลื่อน ดูไม่มืออาชีพ เลย ใช้ยาก") and separately asked to be able to use
the annotation tools (Arrow/Box/Text/Number/Redact) on mobile too, not just
pick a layout and save - both explicitly reopen scope item 11 had just
closed, not a bug in it. Scoped narrowly with the user's explicit approval
(via two up-front questions) before any code was written: annotation
*placement and editing* only (tap/drag to draw; select, duplicate, delete,
or restyle an already-placed annotation) - free move/resize/pan/zoom/crop
of *images* stays off, exactly as item 11 decided, since nothing about this
request changed the reasoning behind that cut ("การลาก-ย่อ-ขยายบนจอเล็กคือ
UX ที่แย่เสมอ" still applies to images specifically, not to annotations).
Push and deploy both worked cleanly on the first try; the `gh-pages`
branch's own last commit reads `Deploy c02fa3b` (confirmed via
`git fetch origin gh-pages` + `git log`) and a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`. See
"Mobile UX revision" below (right after item 11's own writeup) for the
full detail. `npm run verify` green (typecheck + 243 unit + 33 renderer
parity on 3 engines + 313/318 e2e passed, 5 skipped by design, same 5 as
always - `tests/e2e/mobileLite.spec.ts` grew from 3 cases to 5, net +2 x 3
engines = +6, all green on the first full run after the fixes described
below).

**Real bug found and fixed this session (2026-09-14), unrelated to any
Phase 5 item - the user found it by using the live site: a plain mouse-wheel
scroll panned the board camera with no bound at all.** Reported symptom:
after dropping images and doing nothing else, scrolling the wheel up/down
kept moving the board indefinitely, with no floor - a long scroll down could
carry the board arbitrarily far off-screen, hard to find again. Root cause,
confirmed by reading the code before touching it: `panBy()`
(`src/board/view/camera.ts`) is a pure screen-delta-to-board-delta
translation with no board-size awareness at all, and `applyZoom`/`applyPan`
(`src/ui/BoardCanvas.tsx`) both permanently set `autoFitRef.current = false`
the instant the user zooms or pans even once - so nothing ever re-centers
the camera afterward either. Zoom already had real bounds (`MIN_ZOOM`/
`MAX_ZOOM`, `clampZoom`) - pan simply never got the equivalent. **Fixed** by
adding `clampCenter(camera, board, viewport)` to `camera.ts`, which keeps at
least 80px of overlap between the viewport and the board on each axis at the
current zoom (the same family of guard Figma/Photoshop apply to their own
canvas panning) - called from both `applyZoom` and `applyPan`, so wheel-pan,
space/middle-drag, and zoom-driven re-centering are all covered from one
place with no change needed at the individual gesture handlers. Shipped as
commit `2a023c4`, pushed to `main`, and deployed to the live site, on the
user's approval. Push and deploy both worked cleanly on the first try; the
`gh-pages` branch's own last commit reads `Deploy 2a023c4` (confirmed via
`git fetch origin gh-pages` + `git log`) and a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`.
`npm run verify` green (typecheck + 247 unit - 4 new `clampCenter` cases in
`tests/unit/camera.test.ts` - + 33 renderer parity on 3 engines + 316/321
e2e passed, 5 skipped by design, same 5 as always - one new case in
`tests/e2e/zoom.spec.ts` scrolls the wheel 40x and confirms the board stays
reachable; confirmed this test genuinely fails against the pre-fix code
first (the board's on-screen rect landed ~79,000px off-screen), then passes
with the fix, on all 3 engines - not just written and assumed correct).

### Phase 5 item 11 — done: mobile lite mode

Built this session. `npm run verify` green (typecheck + 243 unit + 33
renderer parity on 3 engines + 312 e2e - 307 passed, 5 skipped by design,
same 5 as always).

- **Scope came from re-reading the product plan, not from this Guide's own
  earlier framing.** This Guide's Phase 5 list described item 11 as "the
  rest of" item 3's overflow fix - a bigger, general mobile-responsive
  rework. `docs/00-product-plan.md` §4.6 actually defines it much more
  narrowly: "MVP: desktop-first ชัดเจน. บนมือถือ: แสดงโหมด lite = เลือกรูป →
  เลือกโหมดจัดวาง → บันทึกภาพ (ไม่มีการย้ายอิสระ)" - pick images, pick a
  layout mode, save; explicitly **no free move/resize** on a small screen,
  because (the plan's own words) "การลาก-ย่อ-ขยายบนจอเล็กคือ UX ที่แย่เสมอ"
  (drag/resize/zoom on a small screen is always bad UX). That's a much
  smaller, better-scoped task than rebuilding the canvas's mouse-only
  gesture set (space+drag/middle-drag pan, wheel zoom, pointer-based
  select/move/resize) for touch - and the plan explicitly says not to.
- **`BoardCanvas` gained one new prop, `interactive` (default `true`)**,
  gating every pointer/keyboard effect that exists only to support
  free-form editing: the wheel effect (pan/zoom/tool-size), the
  space/middle-drag pan effect, the big select/marquee/move/resize/reorder/
  annotation-placement pointer effect, and the keyboard-shortcut effect.
  `onDoubleClick`/`onContextMenu` (re-edit text, right-click menu) are also
  skipped. When `false`, `SelectionToolbar`/`CropToolbar`/`ContextMenu`/
  `ZoomControls`/`AnnotationToolbar` never mount either - there is never a
  selection, an armed tool, or a crop session to show a toolbar for, since
  nothing can create one. `draw()`/`drawInteraction()` themselves needed
  **no changes** - they already just render whatever the store/refs
  currently hold, and `autoFitRef` (true by default, only ever flipped by
  the now-disabled zoom/pan handlers) keeps the camera re-fitting to the
  viewport on every board/viewport change for free, so the preview always
  shows the whole board with no camera for the user to control at all.
- **Nothing else needed a rewrite.** `TopBar.tsx` - the layout/style/gap/
  background chips, the Download split button + `ExportMenu`, Copy - is the
  entire "pick a layout mode -> save" flow the plan asks for, and it
  already scrolls horizontally instead of squishing (item 3) and already
  positions its two popovers with `position: fixed` measured from a real
  `getBoundingClientRect()` (also item 3), which is exactly what a narrow
  viewport needs and already had it for unrelated reasons. `EmptyState.tsx`'s
  "choose files" button is the "pick images" step, unchanged. This is why
  the whole item stayed a small, contained diff instead of a parallel
  mobile UI tree: once the canvas stops needing gesture support, the
  existing chrome was already close to correct.
- **New hook, `src/hooks/useIsMobile.ts`** - a
  `window.matchMedia('(max-width: 700px)')` query, live-updating on
  resize/orientation change (not a one-time check at mount, and not a
  user-agent sniff - a real device rotating, or a desktop window resized
  past the breakpoint, both need to flip modes without a reload).
  `App.tsx` passes `interactive={!isMobile}` to `BoardCanvas`; every effect
  `BoardCanvas` gates on `interactive` includes it in its own dependency
  array, so toggling mid-session correctly attaches/detaches listeners
  rather than leaving stale ones from before the flip.
- **A small, deliberately narrow touch-target CSS bump**
  (`@media (max-width: 700px)` in `styles.css`) - `.chip`/`.btn`/
  `.split-btn__caret` gain a few px more padding below this width, closer
  to the ~44px touch-target guideline. Scoped to just those three, not
  every control (e.g. the 24px popover swatches) - the ones a mobile user
  actually has to hit to complete the lite flow (layout mode, style,
  Download/Copy), not a general sizing pass over controls that only exist
  inside a popover the user is already looking directly at.
- **Verified live, not just via the automated suite:** ran a real
  Playwright session at a 390x844 (iPhone-sized) viewport against the dev
  server and screenshotted the board with two images loaded, the
  Background popover open, and the Export popover open - all three render
  cleanly with no overflow/clipping, confirming `ExportMenu`/
  `BackgroundMenu`'s existing `position: fixed`-from-real-anchor
  positioning (item 3/item 4) already handles a narrow viewport correctly
  with no changes needed.
- **New `tests/e2e/mobileLite.spec.ts`** (3 cases x 3 engines = 9) at the
  same 390px viewport: `.zoom-controls`/`.annotation-toolbar`/
  `.selection-toolbar` never mount, and the layout/style/background/export
  controls are all present and clickable; a click *and* a full drag
  gesture on the board - the exact gesture `selection.spec.ts`/
  `moveResize.spec.ts` prove selects/moves a node at desktop width - both
  leave `.selection-status` empty and the sampled pixel unchanged (same
  gradient-fixture pixel-sampling technique as `moveResize.spec.ts`'s own
  `pixelAt`, reused verbatim rather than reinvented, per the item 6 e2e
  gotcha about the fixtures being gradients, not flat colors); and the full
  flow (pick 3 images, pick Grid, Download) produces a real downloaded
  file.
- **Deliberately not done, scoped to exactly what the product plan's §4.6
  line asks for:** no touch gestures at all (pinch-zoom, two-finger pan,
  long-press) - lite mode has no camera for the user to control and no
  per-node editing to gesture at, so there is nothing for a gesture to do;
  no separate/simplified mobile-only version of `TopBar`/`EmptyState`/
  `ExportMenu`/`BackgroundMenu` - the existing desktop components already
  satisfy the lite flow once the canvas stops demanding gesture support,
  and duplicating them would be exactly the kind of speculative surface
  CLAUDE.md says not to add; no UA-based redirect or separate mobile route
  - the same `App.tsx` renders both modes, switching only on live viewport
  width; no change to the annotation/crop/undo/redo machinery itself - it
  still exists and works exactly as before at desktop width, `interactive`
  only ever turns it off, never changes its behavior when on.

### Mobile UX revision — done: settings popover + annotate-only tool support

Built this session, shipped as commit `c02fa3b`, pushed to `main`, and
deployed to the live site - see the note under START HERE above for the
push/deploy confirmation. `npm run verify` green (typecheck + 243 unit +
33 renderer parity on 3 engines + 313/318 e2e passed, 5 skipped by design,
same 5 as always).

- **Scope was pinned down with two explicit questions before any code, not
  discovered mid-implementation:** (1) annotate-only (tap/drag to place;
  select/duplicate/delete/restyle what's already placed - no free image
  move/resize/pan/zoom) rather than full touch parity with desktop, and (2)
  redesign the top bar as icon-only primary controls plus one popover for
  everything else, rather than a bottom-sheet/hamburger rebuild. Both were
  the user's own choice between two framed options, not this session's
  default.
- **`BoardCanvas` gained a second prop, `annotate` (default `false`),
  independent of `interactive`.** A derived `canAnnotate = interactive ||
  annotate` now gates: the annotation-tool pointer/keyboard branches
  (arrow/box/text/marker/redact placement - these needed no change at all,
  they already worked identically regardless of `interactive`, only the
  effect's outer `if (!interactive) return` guard was stopping them from
  ever running on mobile), `AnnotationToolbar`/`SelectionToolbar`/
  `ContextMenu` mounting, and the double-click-to-re-edit-text/context-menu
  canvas handlers. `ZoomControls`/`CropToolbar` mounting and the pan/zoom
  wheel and space-drag effects stay gated on `interactive` alone - there is
  still no pan/zoom or per-image crop on mobile, unchanged from item 11.
  `App.tsx` now passes `annotate={isMobile}` alongside the existing
  `interactive={!isMobile}`.
- **Three separate guards, not one, keep an *image* node unselectable/
  unmovable in annotate-only mode** - `selectedIds` is store-level state that
  can in principle carry a stale image id across a window resize that
  crosses the mobile breakpoint, so this isn't provable from a single check:
  the resize-handle hit-test is skipped outright when `!interactive`; the
  main pointerdown handler's hit-test bails immediately if the hit node is
  `kind === 'image'` and `!interactive`; the marquee-select result is
  filtered to exclude image ids the same way; and the right-click/long-press
  context-menu handler applies the identical filter before opening. An
  annotation-kind hit falls through to the ordinary desktop selection/move
  logic unchanged in every one of these paths - `SelectionToolbar`'s
  `onCrop` also stays `undefined` automatically in this mode (its own
  `canCrop` can only be true for an image selection, which these guards make
  impossible), so nothing had to special-case "no crop on mobile" a second
  time.
- **`TopBar.tsx`'s Background/Layout/Style/Gap - the four controls that,
  combined, were forcing `.topbar` into item 3's horizontal-scroll fallback
  - now live behind one settings icon (`⚙`) on mobile, via a new popover,
  `src/ui/MobileSettingsMenu.tsx`.** Same fixed-position/anchored-from-
  `getBoundingClientRect()`/`useFocusTrap` pattern `BackgroundMenu`/
  `ExportMenu` already established, just stacking four sections instead of
  one control, and deliberately *not* auto-closing after a single pick the
  way the standalone `BackgroundMenu` does - a panel this size is more
  likely to get several taps in a row (layout, then style, then a gap
  nudge) than one. `LAYOUTS`/`STYLES`/`GAP_MAX` were pulled out of
  `TopBar.tsx` into a new shared `src/ui/topbarOptions.ts` so the desktop
  inline version and this popover read from one source instead of two
  copies that could drift.
- **Getting the bar to actually fit 390px took two more removals, found by
  measurement, not by guessing:** a throwaway debug test (not committed)
  that read every `.topbar` child's `getBoundingClientRect().width` showed
  the bar was ~220px too wide even after Background/Layout/Style/Gap moved
  out - the brand text ("Snapboard", ~90px) and the "Clear board" button
  (~120px) were the remaining slack. The brand is now `display: none` below
  700px (no functional value once the app is actually in use); "Clear
  board" moved into the bottom of the same settings popover instead of
  staying in the main row - it's rare and already gated behind a native
  `confirm()`, so one extra tap to reach it costs little. With both gone,
  `.topbar`'s own `scrollWidth` sits comfortably under its `clientWidth` at
  390px - confirmed by a direct measurement in the new e2e test, not just
  "looks fine in a screenshot."
- **Touch-target bump for the two toolbars that mount on mobile for the
  first time:** `.annotation-toolbar__btn`/`.selection-toolbar__btn` were
  still at desktop's `--control-h` (28px) - both good enough with a mouse
  pointer, short of the ~44px guideline item 11's own CSS bump already
  applied to `.chip`/`.btn`/`.split-btn__caret`. Added to the same existing
  `@media (max-width: 700px)` block rather than a new one.
- **Real test-writing bug caught while updating `tests/e2e/mobileLite.spec.ts`,
  the same class CLAUDE.md's own gotcha list already documents once:**
  Playwright's `getByRole` name matching is a case-insensitive *substring*
  match by default, not exact - a bare `name: 'Background'` query matched
  the settings button's own accessible name, "Layout, style & background",
  not just the (now-removed) standalone Background button. Fixed with
  `{ exact: true }`, same fix `annotationSettings.spec.ts` needed once
  before for an unrelated pair of buttons.
- **`tests/e2e/mobileLite.spec.ts` rewritten, not just patched** - it went
  from proving "none of this mounts" to proving the opposite for two of the
  three toolbars: `.annotation-toolbar`/`.selection-toolbar` now assert
  `toHaveCount(1)`, `.zoom-controls` still asserts `toHaveCount(0)`. The
  "clicking or dragging never selects or moves a node" test was renamed and
  narrowed to say *image* explicitly (its own premise no longer covers
  annotations) and now opens the settings popover first to reach the
  "Stacked" layout chip. A new direct measurement test checks
  `.topbar`'s `scrollWidth` against its `clientWidth`. A new test reuses
  `arrow.spec.ts`'s own reddish-pixel-region-scan technique end to end at
  the mobile viewport: arm the Arrow tool, drag to draw, confirm the pixel
  scan and the one-shot revert-to-select, then delete it via the Delete key
  and confirm the pixel is gone - the "place *and* fix a mistake" round trip
  this revision's whole point was to enable.
- **Verified live, not just via the automated suite:** a throwaway
  Playwright script (not committed) screenshotted a 390×844 session - the
  bare board with the compact top bar (no scrollbar visible), the open
  settings popover (all four sections stacked, Clear board at the bottom),
  and the armed Arrow tool (the toolbar's swatch dot turns red) - all three
  matched the intended design with no layout glitches.
- **Deliberately not done, scoped to exactly what was approved:** no touch
  gestures for images at all (pinch-zoom, two-finger pan, drag-to-move/
  resize) - the product plan's own §4.6 reasoning for excluding those from
  a small screen was never in question here, only annotation tooling was;
  no crop on mobile (still per-image free editing, the same category item
  11 already excluded); no general redesign of every top-bar control's
  sizing - just enough removed/regrouped to clear this one viewport width,
  following item 11's own "small, low-risk bump" precedent rather than a
  full responsive rebuild.
- **One real-device caveat worth carrying forward, not resolved here:**
  opening the text tool's textarea overlay from a touch tap relies on the
  same pre-existing `useEffect`-deferred `.focus()` call (unchanged by this
  revision) to also trigger the mobile virtual keyboard. That has always
  worked reliably for a desktop mouse click; iOS Safari's own rule for
  whether a `.focus()` call still counts as "user-gesture-associated" once
  it runs from inside a `useEffect` rather than synchronously in the
  pointerdown handler is stricter and unconfirmed here - headless testing
  has no virtual keyboard to observe at all. Worth a real-phone check
  before calling the Text tool itself mobile-proven, same category as every
  other "needs a real device" gap already tracked in this file.

### Phase 5 item 5 — done: accessibility pass (4 concrete gaps)

Built this session, shipped as commit `2d3f789`, pushed to `main`, and
deployed to the live site. `npm run verify` green (typecheck +
243 unit + 33 renderer parity on 3 engines + 265/270 e2e passed, 5 skipped
by design, same 5 as always).

- **Scope was exactly the 4 gaps item 1's and item 2's own audits already
  named and deliberately deferred here** - not a fresh audit from scratch.
  Re-reading those two items' notes first, before touching anything, is
  what turned this into "close 4 known findings" rather than "re-discover
  what's wrong."
- **New shared hook, `src/hooks/useFocusTrap.ts`** - gives a `role="dialog"`
  popover a real focus trap (Tab/Shift+Tab cycle within it, never escaping
  to the page behind), moves focus into it on open, and restores focus to
  whichever element opened it on close. Used by all **three** of the
  codebase's anchored popovers - `ExportMenu`, `BackgroundMenu`, and
  `AnnotationSettingsPopover` - not just `ExportMenu`, which is the one
  item 1/2's audit named. Reading all three confirmed they share the exact
  same "anchored position + outside-click/Escape closes" pattern (documented
  in each one's own comments as copied from `ExportMenu`), and therefore the
  exact same missing-focus-management gap - fixing only the named one would
  have left the other two (one of them, `AnnotationSettingsPopover`, added
  *after* the audit that found this) with the identical defect.
  Since each of these three components only renders while open (the parent
  does `{open && <Menu .../>}`), mount = open and unmount = close, so a
  plain mount/unmount effect covers every close path (Escape, outside
  click, picking an option that calls `onClose`, the anchor button
  re-toggling, `TopBar`'s scroll-closes-the-popover behavior) for free -
  no `open` prop had to be threaded into the hook at all.
- **Real bug in this session's own new code, caught by a throwaway
  Playwright script before declaring this done, not shipped and found
  later:** the hook's first version called `.focus()` on the popover's
  first focusable child synchronously inside its `useEffect`. Two things
  can beat that call: the popover renders `visibility: hidden` until a
  separate `useLayoutEffect` measures its anchor button's
  `getBoundingClientRect()` and sets real coordinates (all three popovers
  do this - the position depends on where the button that opened them
  actually is), and a hidden element cannot take focus at all - calling
  `.focus()` on it is a silent no-op, not an error. Separately, a real
  browser click's own default action can focus the clicked anchor button
  itself, and depending on timing that can happen after this effect's
  synchronous work already ran. A first pass at the verification script
  showed focus staying on the anchor button in all three popovers -
  exactly this symptom. **Fixed** by deferring the initial-focus call to a
  `requestAnimationFrame`, which reliably runs after both the position
  update and any competing default browser focus behavior have settled.
  Re-ran the same script after the fix - passed on all three.
- **`TopBar`'s Layout and Style chip groups gained `role="group"`** next to
  the `aria-label` they already had - a plain `<div>` has no implicit ARIA
  role (it computes to `generic`), and `aria-label` on a role-less/generic
  element is commonly dropped by screen readers rather than exposed as a
  group name. `AnnotationSettingsPopover`'s own color-swatch group already
  did this correctly (`role="group"` + `aria-label`, from Phase 5 annotation
  revision part 1) - grepping for every other `className="group"` in
  `src/ui/` while fixing the named `TopBar` case turned up `ExportMenu`'s
  Format and Scale groups had no `role` *or* `aria-label` at all, so those
  got both, not just the two `TopBar` groups the audit named.
- **The gap slider (`TopBar`), the JPG-quality slider (`ExportMenu`), and
  the annotation-size slider (`AnnotationSettingsPopover`) all gained an
  explicit `htmlFor`/`id` pair** between their wrapping `<label>` and
  `<input>`, instead of relying only on the implicit association from
  nesting. All three already had an `aria-label` on the `<input>` too
  (which wins for accessible-name computation regardless), so this changes
  nothing about what a screen reader announces - it closes the literal
  "not *explicitly* associated" gap the audit named, for tools/linters that
  specifically check for `for`/`id` rather than accepting implicit nesting.
  Checked against every e2e selector that touches these three sliders
  (`getByLabel('Gap')`, `getByRole('slider', { name: 'Size' })` ×4 in
  `annotationSettings.spec.ts`/`annotationEdit.spec.ts`) before making the
  change - all still pass unchanged, since the `aria-label` (unchanged)
  is what those selectors were always matching against, not the label
  text.
- **`.text-edit`'s contrast fix - the one gap of the 4 that needed a real
  design decision, not just markup.** The overlay's background was
  `color-mix(in srgb, var(--surface) 70%, transparent)` - translucent,
  composited live over whatever image content the user is annotating. Its
  real contrast against the also-fixed `--annotation` red text therefore
  depends on the pixels underneath it, which is exactly why item 2's audit
  measured it as low as 2.64:1 in dark mode and 3.20:1 in light mode (both
  failing AA 4.5:1) against one particular click point - a different click
  point could measure better or worse, since nothing about the mechanism
  guarantees a floor. **Fixed** by making the backing fully opaque instead
  of translucent: a new token, `--text-edit-bg: #ffffff`, placed in the
  board-content group in `:root` (deliberately absent from the
  `prefers-color-scheme: dark` block, same as `--annotation`/`--checker*`
  right above it) - it has to stay fixed for the same reason `--annotation`
  does: it exists specifically to guarantee contrast against a color that
  itself never changes with the theme, so following the theme would
  reintroduce exactly the failure being fixed in one of the two modes.
  White against `#dc2626` computes to **~4.83:1 from relative luminance
  alone** (no compositing left to vary, since the backing is now fully
  opaque) - confirmed live via `getComputedStyle` + the actual relative-
  luminance formula in a real browser, in both a light- and dark-
  color-scheme context, both reading exactly 4.83:1 regardless of what
  image content sits underneath (unlike before, this is now provably
  content-independent, not just re-measured at a different point and
  hoped to generalize).
- **No new automated test added** - same call item 2's dark-mode
  verification pass made for its own bug fixes (`.btn--done`'s hover
  cascade): these are DOM/CSS-level properties (focus location, tab order,
  role attributes, computed contrast) that no existing e2e spec asserts on
  either way, so nothing in the suite could have regressed and nothing new
  needed covering by it. Verification was a throwaway Playwright script
  (not committed, same disposable-tool pattern the halo-vs-shadow
  comparison and the Thai-font pixel-diff both used) that drove all three
  popovers through open → check-focus-is-inside → Tab-loop →
  Escape → check-focus-restored, plus the `.text-edit` contrast probe in
  both color schemes.
- **Deliberately not done, scoped to exactly the 4 named gaps:** no
  `aria-modal="true"` on the three popovers - they close on outside click
  like a menu, not only on an explicit dismiss like a true modal dialog, so
  marking them fully modal to assistive tech would overstate what they
  actually do; no broader ARIA/keyboard audit beyond what item 1/2 already
  found (the "partly already true by construction" list in the Phase 5
  section below - shortcuts, the canvas `aria-live` region,
  `:focus-visible`, `prefers-reduced-motion` - was re-confirmed still true
  in passing, not re-built); no Lighthouse run - the tool isn't installed
  in this environment, so the Phase 5-level "a11y > 95" target is closed
  only as "these 4 named gaps are fixed and verified by other means," not
  by that specific number. Worth a real Lighthouse pass on a real machine
  if that exact score is ever needed.

**Phase 5 item 6 (friendly error messages) is now done, shipped as commit
`62094db`, pushed to `main`, and deployed to the live site**, on the
user's approval. Push and deploy both worked cleanly on the first try;
the `gh-pages` branch's own last commit reads `Deploy 62094db` (confirmed
via `git fetch origin gh-pages` + `git log`) and a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`. See
"Phase 5 item 6" below for the full writeup, including a real pre-existing
bug this audit found: the file-rejection toasts (`toast.rejected.*`) were
never actually reading from `src/i18n/en.ts` at all - a second, hardcoded
copy of the same five messages lived directly in `boardStore.ts`'s
`rejectionMessage()`, silently bypassing the i18n layer this file's own
header comment says every user-facing string must go through. Editing
`en.ts` alone would have changed nothing a real user ever saw. Fixed by
routing `rejectionMessage()` through `t()` and deleting the duplicate
literals - this also means item 10 (Thai i18n) will actually pick up these
five strings when it adds a `th.ts`, instead of silently missing them.
**Also found, not fixed - a pre-existing, order-dependent e2e flake,
unrelated to this item's own change (confirmed by re-running the same two
tests against a clean `git stash` of this session's diff, where they still
failed the same way):** `tests/e2e/annotationEdit.spec.ts`'s two "size
slider... grows/thickens an already-placed node" cases (chromium only)
fail intermittently - which of the two fails, or whether both do, varies
run to run. Not investigated further since it's out of this item's scope
(tone/copy, not the settings-popover slider mechanics) and it isn't a
regression this session introduced - worth a real look next time that area
of the code is touched.

**Phase 5 items 7 (right-click context menu) and 8 (help modal / shortcut
cheatsheet, opened with `?`) are now built, verified, pushed to `main`, and
deployed to the live site**, shipped as commit `99124a1`, on the user's
approval. Push and deploy both worked cleanly on the first try; the
`gh-pages` branch's own last commit reads `Deploy 99124a1` (confirmed via
`git fetch origin gh-pages` + `git log`) and a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`.
`npm run verify` green (typecheck + 243 unit + 33 renderer parity on 3
engines + 297/303 e2e passed, 5 skipped by design plus the same 1
pre-existing chromium-only `annotationEdit.spec.ts` flake item 6's own note
already documents, unrelated to this session - this session added 11 new
e2e cases (6 in the new `tests/e2e/contextMenu.spec.ts` + 5 in the new
`tests/e2e/help.spec.ts`) × 3 engines = 33, all green). See "Phase 5
items 7 and 8" below for the full writeup, including two real bugs this
session's own new e2e coverage caught in the new code itself (not
pre-existing) before either was declared done.

**Phase 5 item 9 (animation / micro-interactions) is now done, verified,
pushed to `main`, and deployed to the live site**, shipped as commit
`efbf37e`, on the user's approval. Push and deploy both worked cleanly on
the first try; the `gh-pages` branch's own last commit reads
`Deploy efbf37e` (confirmed via `git fetch origin gh-pages` + `git log`)
and a same-session `curl -o /dev/null -w '%{http_code}'` for `/` returned a
fresh `200`. Scoped to exactly the three pieces the user approved up front:
entrance animation for every popover/modal (ExportMenu,
BackgroundMenu, AnnotationSettingsPopover, ContextMenu, HelpModal - fade +
a small scale/translate, deliberately entrance-only, no exit animation, see
"Phase 5 item 9" below for why), toast enter+exit, and hover/press feedback
on every clickable control that was missing a transition/`:active` state.
`npm run verify` green (typecheck + 243 unit + 33 renderer parity on 3
engines + 298/303 e2e passed, 5 skipped by design, same 5 as always - **the
1 pre-existing chromium-only `annotationEdit.spec.ts` flake item 6's note
first found is now fixed, not just carried forward**, see below). Also
found and fixed a real accessibility bug in `useFocusTrap` along the way -
see "Phase 5 item 9" below for the full writeup.

### Phase 5 items 7 and 8 — done: right-click context menu, help modal / shortcut cheatsheet

Built this session. `npm run verify` green (typecheck + 243 unit + 33
renderer parity on 3 engines + 297/303 e2e passed, 5 skipped by design plus
1 pre-existing flake, same counts as the top note above).

- **Item 7 (`src/ui/ContextMenu.tsx`) is deliberately just a second entry
  point to the exact same four actions `SelectionToolbar` already exposes**
  (Crop/Duplicate/Bring to front/Delete) - no new store actions, per the
  Phase 5 list's own framing of this item. Right-clicking a node selects it
  first if it wasn't already part of the current selection (a right-click on
  a node that's already part of a multi-selection keeps the whole selection,
  so Duplicate/Delete still apply to all of it); right-clicking empty space
  suppresses the browser's native menu but opens nothing, since there's no
  selection-scoped action to offer there. Crop is gated the identical way
  `SelectionToolbar`'s own Crop button already is (`selectedIds.length === 1
  && node.kind === 'image'`) - reusing `BoardCanvas`'s existing `canCrop`/
  `beginCrop` rather than recomputing the rule a second time. Positioned at
  the click point via the same "measure once rendered, then clamp to the
  viewport" technique `ExportMenu` already uses for its own anchor-relative
  positioning, and reuses `useFocusTrap` the same way every other popover
  does, with a `null` `anchorRef` (there's no anchor button for a right
  click) - the hook already tolerates that, falling back to whatever had
  focus before the menu opened.
- **Real bug this item's own e2e coverage caught immediately - every single
  `contextMenu.spec.ts` case failed identically on all 3 engines the first
  time it ran, "menu never becomes visible":** the first version also added
  a `document.addEventListener('contextmenu', ...)` inside `ContextMenu`'s
  own effect, intended to close/reposition the menu if the user right-clicks
  elsewhere. That listener gets attached *while the very `contextmenu` event
  that opened the menu is still bubbling toward `document`* - React commits
  the newly-mounted component and flushes its effects synchronously within
  the same event dispatch, so the new listener is live in time to catch that
  same still-in-flight event once it continues past the component and
  reaches `document`, self-cancelling the menu the instant it opens. Fixed
  by deleting that listener outright - it was never necessary in the first
  place: any mouse button's `mousedown` (including the right button) already
  fires *before* its own `contextmenu` does, so the existing
  `mousedown`-outside-closes listener already covers "right-click elsewhere"
  correctly with no risk of catching its own opening event.
- **Item 8 (`src/ui/HelpModal.tsx`) is a static reference built by hand from
  `BoardCanvas.tsx`'s own keydown handler(s)** - every binding grouped into
  General/View & pan/Selection/Annotate/Editing sections, shown next to a
  literal key label (via `modKey()` for `Ctrl` vs `Cmd`, same helper
  `toolbar.copyTitle` already uses). Cross-checked against every `key ===`/
  `e.key`/`code ===` site in `src/` while writing it - CLAUDE.md's own
  existing shortcut list (`+ - 0 1 Esc Del/Backspace D F A R T N C` plus the
  four modifier combos) was accurate but missed two real bindings the
  cheatsheet now also lists: **`Space` held for click-drag panning**
  (`BoardCanvas.tsx`'s pan effect - a genuine, discoverable interaction nowhere
  else documents), and plain **`Enter`** to confirm an in-progress crop
  session, distinct from `Ctrl/Cmd+Enter` to commit a text edit. Opened via
  `?` (a global `window` keydown listener in `App.tsx`, not inside
  `BoardCanvas.tsx` where every other shortcut lives - `BoardCanvas` only
  mounts once `board.nodes.length > 0`, but a first-time user on the empty
  state is exactly who most needs this) or a small, always-visible `?`
  button added to the far right of `TopBar` (the one button in that bar not
  gated on `hasImages`, for the same reason).
- **Two real bugs, both caught by this item's own e2e coverage, not by
  reasoning about the code - worth remembering before building another
  "swallow the page's shortcuts while X is open" modal:**
  1. **The first version relied on React's `onKeyDown` prop on the modal's
     backdrop `<div>`, calling `stopPropagation()` there to keep every
     keypress from leaking to `BoardCanvas`'s global `window` shortcut
     listener while the modal was open.** That prop is delegated through
     React's own listener attached at the root DOM container, not a real
     listener on the backdrop element itself - relying on its
     `stopPropagation` to reliably block the event from ever reaching
     `window` did not hold up: the "Escape closes the modal" case failed
     (Escape stopped working at all) and, more surprisingly, the "keys don't
     leak underneath" case *also* failed the other way (pressing `A` still
     armed the arrow tool on the board behind the modal). **Fixed** by
     attaching a genuine `addEventListener('keydown', ...)` directly to the
     backdrop's own DOM node (via a ref, the same pattern `useFocusTrap`
     itself already uses for its Tab-trap listener) instead of going through
     React's synthetic prop - a real listener on a real node is guaranteed
     by the DOM's own bubble order to run after `useFocusTrap`'s Tab-handling
     (a descendant) and before anything outside this subtree, with no
     dependence on exactly where React's internal delegation happens to sit
     relative to `document`. Also folded the Escape-closes-the-modal logic
     into this same listener rather than a second, separate `document`-level
     one - one place for this to go wrong instead of two racing.
  2. **Even with a real listener on the backdrop's own node, one case still
     leaked through - `webkit` only:** pressing `A` immediately after the
     modal became visible still armed the arrow tool, but only in WebKit.
     Root cause: `useFocusTrap`'s `requestAnimationFrame` (which moves focus
     into the modal on open) can still be pending when the very next key is
     pressed - Playwright's `press()` can fire before that frame has run,
     apparently more consistently reproducible under WebKit's timing than
     the other two engines here. While focus is still wherever it was
     *before* the modal opened (outside the backdrop's subtree entirely), an
     event targeting it never bubbles through the backdrop's listener at
     all - there's nothing wrong with that listener itself, it simply never
     sees an event whose target isn't one of its descendants. **Fixed** with
     a second, independent safety net: a *capture-phase* listener on
     `window` (the very first stop in the entire event path, regardless of
     the current target) that steps aside the instant the event's target is
     already inside the modal's own subtree (so Tab-trap navigation and the
     Close button's keyboard activation are completely unaffected), and
     otherwise stops propagation and handles Escape itself. This covers the
     race unconditionally, regardless of engine timing, rather than chasing
     a timing fix for `useFocusTrap`'s own `raf` specifically.
- **Deliberately not done, scoped to exactly what these two items ask for:**
  no new store actions for item 7 (see above - it is purely a second UI
  surface over four actions that already exist); no persistence of anything
  for item 8 (a static reference has nothing to persist); no attempt to make
  item 8's shortcut list dynamically generated from the keydown handler's own
  source (it's a hand-built, one-time list per this item's own framing in the
  Phase 5 plan - "by this point every shortcut... is known and stable...not
  something that needs updating per-item going forward"); no right-click
  support for annotation nodes' own color/size editing (`SelectionToolbar`'s
  "Edit style" button) - the Phase 5 list names Crop/Duplicate/Bring to
  front/Delete specifically, and style-editing already has its own discovery
  path (the swatch button that appears in the same toolbar).

### Phase 5 item 9 — done: animation / micro-interactions

Built this session. `npm run verify` green (typecheck + 243 unit + 33
renderer parity on 3 engines + 298/303 e2e passed, 5 skipped by design,
same 5 as always).

- **Scope was fixed with the user up front, before any code, via three
  explicit yes/no choices** (this item had no mockup or prescribed scope,
  unlike Phase 2-4's items): popover/modal entrance animation, toast
  enter+exit, and button/control hover-press feedback. A fourth option
  (canvas-level selection/drag feedback) was offered and explicitly not
  chosen - board-content rendering is a different, much larger surface than
  a CSS transition, and nothing asked for it specifically.
- **Popover/modal entrance only, no exit animation - a deliberate,
  documented trade-off, not an oversight.** All five popovers/modal
  (`ExportMenu`, `BackgroundMenu`, `AnnotationSettingsPopover`,
  `ContextMenu`, `HelpModal`) share one `@keyframes popover-in` (fade +
  `translateY(-4px) scale(0.98)`, ~130-160ms) added directly to their
  existing CSS classes - no component/prop changes needed, since every one
  of them is already unconditionally rendered while open (`{open && <X/>}`).
  An exit animation would require keeping the component mounted a beat past
  `onClose`, which breaks the exact invariant `useFocusTrap`'s own comment
  documents and relies on - "mount = open, unmount = close... no `open`
  prop needed" (Phase 5 item 5). Toasts have no such invariant (no focus
  trap at all), so they got the full enter+exit treatment instead - see
  below.
- **A real, pre-existing accessibility race in `useFocusTrap.ts`, found only
  because adding the popover-in animation made it fail far more often, not
  by reasoning about the hook in isolation.** The hook's mount-time
  `requestAnimationFrame` unconditionally focused the popover's first
  focusable child, with no check for whether something had already been
  focused inside the popover by then. This raced against anything else that
  focuses a specific control inside the popover shortly after it opens - a
  real keyboard user tabbing in, or (what actually surfaced it)
  `AnnotationSettingsPopover`'s own e2e coverage calling `.focus()` on the
  size slider right after opening it. Confirmed with a throwaway
  instrumented test reading `document.activeElement`: **without** the new
  animation this raced and lost about 1 time in 8 (a real but rare
  pre-existing bug); **with** it, about 4 times in 5 - consistent with the
  animation's extra per-frame paint work shifting when the raf actually
  fires relative to Playwright's own round-trip timing. This is exactly the
  pre-existing, order-dependent `annotationEdit.spec.ts` size-slider flake
  Phase 5 item 6's own note already flagged and deliberately left
  uninvestigated ("worth a real look next time that area of the code is
  touched") - this was that look. **Fixed at the source, not just in the
  test:** the raf callback now checks `container.contains(document.activeElement)`
  first and does nothing if something inside the popover already has focus
  - it only force-focuses the first child when focus is still genuinely
  outside the popover (a hidden element silently having ignored an earlier
  `.focus()` call, or the anchor button's own default-focus behavior
  landing outside the container), which is the only case this raf ever
  existed to handle. Confirmed the fix directly: the same instrumented test
  went from ~80% failure to 10/10 clean with the animation still in place.
  Two `annotationEdit.spec.ts` assertions were also hardened from a single
  read to `expect.poll(...)`, since even with the focus race gone there's a
  separate, genuine (if much smaller) gap between the store committing a
  size change and the canvas repaint reflecting it - polling is the correct
  fix for that, not a fixed sleep.
- **A second, narrower timing issue, same root cause (reading a popover's
  geometry while its own entrance animation is still playing):**
  `annotationEdit.spec.ts`'s pixel-exact popover-position regression test
  (`toBeCloseTo(btnBox.x, 0)`, added in the "third round of real-usage
  feedback") could sample `boundingBox()` mid-animation, when the
  `scale(0.98)` transform hasn't finished settling yet - off by ~1-2px
  against a precision-0 assertion. Fixed by waiting out the animation
  duration before reading positions in that one test, with a comment
  explaining why the wait exists now (it didn't need one before this item).
- **Toast enter+exit (`Toasts.tsx`)** - previously the store's own 4s
  auto-dismiss timer (or a manual dismiss) removed a toast from the
  `toasts` array and its DOM node vanished in the same instant, with only
  the entrance (`toast-in`) animated. `Toasts.tsx` now mirrors the store's
  array into local state instead of rendering it directly: when an id
  leaves the store's list, the local copy marks it `exiting` and keeps
  rendering it (with a new `.toast--exiting` CSS class - fade + slide,
  matching the entrance) for one more ~160ms beat before actually dropping
  it. No focus-trap or other open/close-sensitive behavior applies to a
  toast, unlike the popovers above, so this carries none of the same risk -
  confirmed safe against the one existing e2e reference to `.toast`
  (`performance.spec.ts`'s "wait for a toast to appear"), which doesn't
  depend on removal timing at all.
- **Button/control hover-press feedback** - `.chip`, `.swatch`,
  `.selection-toolbar__btn`, `.annotation-toolbar__btn`, `.zoom-btn`/
  `.zoom-pct`, `.context-menu__item`, `.help-modal__close`, and
  `.recovery-dismiss` all gained a `transition` where they had none at all
  before (hover/color changes were instant), and the buttons/swatches
  people click most often (chip, swatch, the three icon-button toolbars)
  also gained a small `:active { transform: scale(...) }` press-down cue -
  `.btn` already had both from Phase 1, so this closes the same gap
  everywhere else. `.annotation-toolbar__btn`'s press rule is guarded with
  `:not(:disabled)`, matching its existing disabled-opacity rule.
  `.context-menu__item` deliberately gets the color/background transition
  only, no press-scale - a full-width menu row scaling down reads oddly
  compared to a small icon button doing the same.
- **Verified live, not just via the automated suite** - started the dev
  server, dropped a real image, and screenshotted the board and the export
  popover mid- and post-entrance-animation; both render cleanly with no
  layout glitches.
- **Deliberately not done, scoped to exactly what was approved:** no exit
  animation for the five popovers/modal (see above - a real invariant, not
  a missed opportunity); no canvas-level selection/drag/layout-reflow
  animation (explicitly declined up front - much larger surface, nothing
  asked for it); no animation library or new abstraction - every effect
  here is a plain CSS `transition`/`animation`/`@keyframes`, consistent
  with the near-zero baseline this item inherited.

### Phase 5 item 6 — done: friendly error messages

Built this session. `npm run verify` green (typecheck + 243 unit + 33
renderer parity on 3 engines + 264/270 e2e passed, 5 skipped by design plus
1 pre-existing flake noted above - same 265/270 as item 5 shipped with).

- **Scope was exactly what the Phase 5 list item says: an audit/review
  pass of existing copy, not new plumbing.** Read every `toast.*` and
  `toast.rejected.*` string in `src/i18n/en.ts` for tone rather than
  writing anything new - most of them (recovery, cleared-board, copy
  confirmations) already read warm and reassuring from Phase 1/2/the
  Clear-board safety net, and were left untouched.
- **The five rejection messages (`not-an-image`, `svg-not-supported`,
  `too-large`, `too-many-pixels`, `corrupt`) and `toast.copyFailed` were
  the ones that actually needed softer wording** - the originals read as
  blunt system errors ("{{name}} could not be read as an image", "SVG
  files are not supported") with no hint at what to do next. Reworded to
  use contractions (matching the app's existing casual voice - the
  tagline is "Paste. Arrange. Copy.", not "Paste content. Arrange
  content."), and gave the two size-related rejections distinct wording
  (`too-large` = file size, `too-many-pixels` = pixel dimensions) since
  the old phrasing for both ("is larger than 50 MB" vs "has too many
  pixels") could otherwise read as the same complaint restated. The SVG
  message now suggests an alternative (PNG/JPG) instead of just stating
  the refusal.
- **The real find: `rejectionMessage()` in `boardStore.ts` never called
  `t()` at all** - it had its own hardcoded switch returning the exact
  same five strings as literals, predating this session. `en.ts`'s
  `toast.rejected.*` keys were dead code, never read by anything.
  Confirmed by grepping for both `rejectionMessage` and `toast.rejected`
  across `src/` before touching either. Fixed by importing `t` into
  `boardStore.ts` and having each switch arm call the matching key -
  `en.ts` is now the actual single source for these five strings, not
  just a second copy of them.
- Two e2e assertions in `tests/e2e/board.spec.ts` matched the old literal
  text (`'SVG files are not supported'` and a regex on `'is not a
  supported image'`) and needed updating to the new wording - the only
  test-suite fallout, found by grepping test files for the old strings
  before changing any copy, not by running the suite and reacting to
  failures.
- **Deliberately not done, scoped to what a tone pass alone needs:** no
  new toast for `exportBoard.ts`'s one `throw new Error('Could not create
  an export canvas')` - it has no catch block anywhere in its call chain
  today (an unhandled-rejection, not a shown message), and giving it one
  would be new error-handling plumbing, not a rewording of something that
  already exists, which this item's own scope explicitly excludes. Also
  didn't touch `export.willDownscale`/`toast.exportDownscaled` (the
  scale-guard notices) - both already read as informative context rather
  than a scolding error, so there was nothing to soften.

### Phase 5 item 4 — done: 6 gradient backgrounds

Built this session, shipped as commit `a8007b5` - not yet pushed to `main`
or deployed to the live site, pending the user's go-ahead. `npm run verify`
green (typecheck + 243 unit + 33 renderer parity on 3 engines + 256/261 e2e
passed, 5 skipped by design, same 5 as always).

- **`Background` gained a third variant** - `{ type: 'gradient'; from:
  string; to: string }` - alongside 6 new named entries in `BACKGROUNDS`
  (`src/board/model/types.ts`): Sunrise, Ocean, Mint, Berry, Dusk, Midnight,
  each a well-known 2-stop pair rather than an invented one. Fixed presets,
  not a custom color picker - the same "no decision nothing asked for yet"
  scope cut every annotation tool's color choice already made before the
  annotation revision reopened it for those specifically. Board content, so
  none of the 6 follow the OS theme, same reasoning as `--annotation`/
  `--checker*`.
- **`renderScene.ts`'s fill branches on the new type**: `ctx.createLinearGradient(0,
  0, size.w, size.h)` - corner-to-corner, not axis-aligned, so it reads as
  one consistent diagonal sweep regardless of the board's own aspect ratio.
  `drawBadge`'s ring-color ternary (`background.type === 'solid' ? ... :
  BADGE_RING_ON_TRANSPARENT`) needed no code change at all - flagged ahead
  of time as a blast-radius risk, but the existing "anything non-solid falls
  back to the same translucent ring" logic was already the right behavior
  for a gradient (there's no single color to match), not a gap - only the
  comment was updated to say so explicitly.
- **The picker moved from 3 inline top-bar swatches to a popover
  (`src/ui/BackgroundMenu.tsx`)**, opened from a single new "Background"
  button, rather than adding 6 more swatches inline - the standing
  mobile-overflow finding (item 3's own note) was an explicit reason to
  choose this over the simpler inline extension. Same fixed-position/
  anchor-measured-from-`getBoundingClientRect()` pattern `ExportMenu.tsx`
  already established, including the same "don't special-case the anchor
  button in the outside-click listener" behavior (a click there both closes
  and toggles in the same event, which nets out correctly - verified, not
  just assumed, since a naive reading suggests it could double-fire; this
  mirrors `ExportMenu`'s own unmodified listener exactly rather than
  inventing a different mechanism). The toggle button itself shows a small
  live preview swatch (`.swatch--preview`) of the board's current
  background, via a new shared `backgroundSwatchStyle()` helper also used by
  the popover's own 3×3 grid of options.
- **`tests/render/harness.ts`'s `SceneSpec.background` widened from a
  3-value literal union to `BackgroundName`** (all of `BACKGROUNDS`'s keys),
  so the parity harness could address a gradient scene at all.
  `tests/render/render.spec.ts` gained one new parity scene (`gradientOcean`,
  **`style: 'plain'`, deliberately not `'card'`**) and one dedicated
  corner-to-corner color check.
- **Two real bugs, both caught by this item's own new tests failing against
  themselves, not against the app - worth remembering before adding another
  render-parity scene:**
  1. The new parity scene at `style: 'card'` pushed Chromium's max channel
     error to 4 against the existing shared tolerance table's `≤ 2` - not a
     product bug, but the well-documented ADR-002/007 tile-shadow-edge
     antialiasing gap showing up more visibly when the backdrop it's
     composited against is a gradient instead of a flat color, which this
     scene wasn't meant to measure in the first place. Fixed by using
     `style: 'plain'` for this scene instead, which has no shadow/rounded
     corners to trigger that unrelated effect - not by loosening the shared
     tolerance table, which stays scoped to the card/soft-style scenes it
     already covered.
  2. The new `gradientCorners` harness function sampled `bm.width - 1`/
     `bm.height - 1` (`bm` being the decoded `ImageBitmap`) **after** calling
     `bm.close()` on it - on at least one engine here, `close()` zeroes those
     two properties, silently turning "sample the last pixel" into "sample
     (-1, -1)", which reads as always-transparent (alpha 0) regardless of
     what's actually drawn there. All 3 engines failed identically, which is
     what made this look like a real bug at first. Fixed by reading the
     backing `OffscreenCanvas`'s own `c.width`/`c.height` instead - those are
     set once at construction and are never affected by closing an unrelated
     bitmap. Worth checking first if any future harness function reads an
     `ImageBitmap`'s dimensions after `.close()`.
- `tests/e2e/board.spec.ts`, `privacy.spec.ts`, and `screenshots.spec.ts` all
  clicked the old inline `Black` swatch button directly and needed a
  one-line change each (open the `Background` popover first) - found by
  running the full `npm run e2e` suite, not by reasoning ahead of time; a
  targeted `grep` afterward confirmed those were the only three call sites.
- **Deliberately not done, scoped to what "6 gradients" alone needs:** no
  custom color/angle picker (fixed presets only, see above); no gradient
  option added to `AnnotationSettingsPopover`/redact/any annotation tool
  (this item is board-background only, unrelated to per-node annotation
  color); no persistence of the chosen background beyond what already
  applies to the whole `Board` (background has always been part of `Board`,
  so autosave/undo already cover it for free - nothing new to wire up).

### Phase 5 annotation revision, part 3 — done: text box grows/shrinks with content

Built this session, shipped as commit `1dc665d`, pushed to `main`, and
deployed to the live site (recorded in `42828bc`). Push and deploy both
worked cleanly on the first try; the `gh-pages` branch's own last commit
reads `Deploy 42828bc` and a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`.
`npm run verify` green (typecheck + 243 unit + 27 renderer parity on 3
engines + 256/261 e2e passed, 5 skipped by design, same 5 as always).

- **The model change CLAUDE.md's own planning note anticipated: `wrapText`/
  `textHeight` and the textarea overlay's auto-resize all assumed a fixed
  width going in, so this needed a real "grow horizontally up to some max,
  then wrap" design, not a parameter tweak.** New function `textAutoWidth`
  (`render/text.ts`) replaces the old fixed `TEXT_DEFAULT_WIDTH` (240) with
  two bounds - `TEXT_MIN_WIDTH` (32, an empty box) and `TEXT_MAX_WIDTH`
  (480, the point where `wrapText`'s existing wrapping takes over instead of
  the box growing further). It measures only the widest `\n`-delimited line
  as a whole (not through `wrapText` - the point of this function is to find
  the width that would make wrapping unnecessary in the first place),
  clamped to those two bounds.
- **Recomputed on every keystroke, not just at creation** - `BoardCanvas`'s
  `onTextEditChange` calls `textAutoWidth` against the live `ctx.measureText`
  after every character typed *or deleted*, so the box grows **and shrinks**
  with the content, the same way Lightshot's own text tool behaves (confirmed
  live via a throwaway Playwright script, not committed: empty → 32px, "hi" →
  35px, a longer sentence → capped at 480px, then back down to 35px on
  deleting back to "hi" - the exact grow/shrink/cap sequence this item asked
  for). The one place width is still seeded rather than recomputed live is
  the initial placement click (`TEXT_MIN_WIDTH` directly, since a fresh
  click always starts with empty text - `textAutoWidth('')` would return the
  same constant, so skipping the call there is just avoiding a redundant
  canvas-context lookup, not a different rule) and a double-click re-edit
  (seeded from the existing node's own already-fitted `frame.w`, then it
  grows/shrinks live from there exactly like a fresh placement does).
- **The settings-popover size slider (real-usage-feedback-round-2's "edit
  style in place" feature) needed the identical fix, not just the live
  typing path:** `onStyleSizeChange` used to recompute only `frame.h` when
  the font-size slider changed an already-placed text node's size, leaving
  `frame.w` at whatever it was fitted to under the *old* font size - a size
  increase could leave the box wider than the new, bigger glyphs actually
  need, or too narrow and wrapping when it didn't have to. Now recomputes
  `width` via `textAutoWidth` first and feeds that into the same `wrapText`/
  `textHeight` calc `frame.h` already used, so the box refits both
  dimensions together, the same "grows with content" rule typing itself
  follows.
- **No changes needed to `commitText`/`boardStore.ts` beyond a comment
  update** - the store already took `frame` as a caller-computed value (see
  `commitText`'s own note on why: text layout needs a real `measureText`,
  which only `BoardCanvas` has), so threading a content-fitted `w` through
  the exact same parameter that already carried a content-fitted `h` needed
  no new plumbing, just a caller-side change to what that `frame` argument
  contains.
- **No new e2e cases needed** - `tests/e2e/text.spec.ts` and
  `tests/e2e/annotationEdit.spec.ts`'s existing pixel-scan regions already
  cover a wide enough area around the click point that a narrower or wider
  box (versus the old fixed 240px) still lands inside them; all 39 cases
  across arrow/box/text/annotationSettings/annotationEdit passed unchanged
  on all 3 engines before this was declared done, plus the throwaway script
  above for the actual pixel-width behavior the automated suite can't assert
  on directly (it reads `.text-edit`'s inline `style.width`, not a rendered
  pixel). `tests/unit/text.test.ts` gained 6 new cases for `textAutoWidth`
  directly (empty→min, short line fits exactly, grows, shrinks, caps at max,
  and picks the widest of several explicit lines rather than the last one).
- **Deliberately not done, scoped to what "grows with content" alone
  needs:** no change to `TEXT_MAX_WIDTH`'s relationship to the board's own
  size (a text box can still be wider than a small board, same as it always
  could at the old fixed 240px); no attempt to make the *height* dimension
  grow any differently than it already did (unchanged - line-count-driven,
  via the same `textHeight` this item didn't touch); no persistence or
  user-facing control over `TEXT_MIN_WIDTH`/`TEXT_MAX_WIDTH` themselves - a
  fixed design decision for this pass, same as every other annotation
  tool's size range.

### Real-usage feedback round 2 — done: board auto-fit, order-independent layout, edit-in-place annotation style, drop-shadow text, font check

Built this session, shipped as commit `2950020`, pushed to `main`, and
deployed to the live site - see the note under START HERE above for the
push/deploy confirmation and `npm run verify` counts.

- **Board auto-fit to content (`fitBoardToContent` in `boardStore.ts`).**
  The user's repro: drop 2 tall portrait screenshots + 1 long horizontal one,
  auto-layout picks `rows` and (depending on file order) ends up putting the
  portraits in one row and the wide one in a second row below - a taller
  board than the user wants. Dragging the wide one up next to the portraits
  to make one short horizontal strip by hand correctly switches the board
  to `'free'` (invariant 4), but `board.size` used to stay frozen at the
  *old*, taller value forever after - relayout() only skips recomputing
  frames for a free board, and there was nothing else that ever revisited
  `size`. Every export/copy from then on carried dead margin above/below the
  actual content. `setFrames` now finishes by calling `fitBoardToContent`,
  which measures the bounding box of every node's frame (images *and*
  annotations - an annotation sitting outside the image area must still
  count, or the fit could clip it) and, if the box's extent actually
  changed, resizes `board.size` to `bounds + padding*2` and **translates
  every node by the same (dx, dy)** so the arrangement itself never moves
  relative to itself - only the shared canvas origin shifts, exactly like
  `computeLayout.ts`'s own `finalize()` already does to an auto layout's
  internal coordinates. Deliberately narrow-scoped to `setFrames` only (the
  exact commit path the bug report hit) - `deleteSelected`/
  `duplicateSelected`/`commitCrop` can theoretically leave `'free'`-mode dead
  space too (e.g. deleting the bottom-most node), but that's a different,
  not-yet-reported gap and adding it there wasn't asked for.
- **This one change had a wide, mostly-mechanical test-suite blast radius,
  worth remembering before touching `setFrames` again:** every existing
  unit test that calls `setFrames` and then asserts an exact absolute frame
  value needed updating, because the fit now re-centers content to sit
  exactly `padding` from the edge whenever the bounding box's own extent
  changes - `tests/unit/boardStore.test.ts`'s fix was to read the *shift*
  off an untouched sibling node (e.g. the still-there image) rather than
  hardcode the new numbers. More seriously, **4 pre-existing e2e tests**
  (`moveResize.spec.ts`, `marker.spec.ts`, `selectionActions.spec.ts`,
  `shortcuts.spec.ts`) broke because they compute page-pixel coordinates
  *before* a drag and reuse them *after* it - previously safe, since a move
  never used to change `board.size` or the camera's fit-to-view zoom. Now
  that it can, those coordinates go stale the instant the board resizes.
  Fixed by re-measuring the relevant node's/board's on-screen rect live
  *after* the move in all four, rather than reusing pre-move numbers - see
  each file's own diff for the exact technique (`selectionScreenRect`/
  `pageRect` called again post-move). One test's own *premise* had to change
  outright: `moveResize.spec.ts`'s "shrinking from a corner handle uncovers
  the board behind it" used a single-image board, where shrinking the only
  image now *also* shrinks the board to match (the fix working exactly as
  intended) - rewritten to use two stacked images instead, so the untouched
  second image still anchors the bounding box and the original "reveals
  background, board stays the same size" assertion is still a real, correct
  invariant to check.
- **Auto-layout `rows` mode is no longer sensitive to input order
  (`layoutRows` in `computeLayout.ts`).** Root cause, confirmed by reading
  the actual code path both ways: drag-drop reads file order from
  `DataTransferItemList` (`useImageInput.ts`), the "Choose files" button
  reads it from the OS dialog's own `FileList` (`EmptyState.tsx`) - two
  different orderings for the identical set of files, both feeding
  `addFiles` with zero reordering anywhere in between. `layoutRows`'s
  packer is a single-pass greedy bin-fill with no look-ahead, so which
  images end up sharing a row (and therefore how good the result looks) was
  a direct function of that arbitrary order. Fixed by having `layoutRows`
  pack a copy sorted by aspect ratio (`[...items].sort(...)`, stable, so
  already-adjacent similarly-shaped images keep their relative order)
  instead of `items` as given - the same set of images now always produces
  the same grouping regardless of which order they arrived in. Deliberately
  scoped to `rows` only: `steps`/`columns` intentionally preserve the user's
  own drop order (it's what numbering means in `steps`), and `grid` is only
  ever chosen when shapes are already similar, so order barely matters
  there. `tests/unit/computeLayout.test.ts` gained a case that runs every
  permutation of a 2-portrait + 1-very-wide set (the user's own repro shape)
  through `computeLayout` and asserts the row-membership pattern (which
  images share a row with which) is identical across all of them, and that
  the resulting canvas size doesn't change either - not a byte-for-byte
  `toEqual` on the frames themselves, since two same-shaped portraits
  swapping which one lands on the left is cosmetically arbitrary and *does*
  differ between permutations.
- **Already-placed annotations can now be recolored/resized in place,
  reopening a cut Phase 4/annotation-revision-part-1 made ("no post-hoc
  editing beyond text content - delete and redraw").** New store actions
  `setNodeColor(id, color)` and `setNodeSize(id, size)` (`boardStore.ts`),
  distinct from `setToolColor`/`setToolSize` which only ever change the
  *next* tool default (`toolSettings`) - these mutate the selected node's
  own fields directly. `setNodeSize` handles arrow/box (their own `size`
  field, clamped) and marker (no `size` field - see `MarkerNode`'s own
  note - so it recomputes `frame` via `markerFrame` centered on the
  *unchanged* center point) but deliberately not text: a font-size change
  also changes the wrapped line count, which needs a real `measureText`
  only `BoardCanvas` has, so `commitText` gained an optional 4th `size`
  parameter instead, and `BoardCanvas`'s new `onStyleSizeChange` computes
  the new wrapped `frame.h` the same way `finishEditingText` already does
  before calling it. Redact keeps color-only, same as every other tool's
  settings popover. New `SelectionToolbar` prop `style` (a `StyleTarget` -
  color, size-or-null, size-range-or-null) drives a new settings button,
  reusing `AnnotationSettingsPopover` completely unchanged - that component
  never actually depended on "tool" vs "node" as a concept, just color/size
  values and callbacks, so no changes to it were needed at all.
- **Real bug this surfaced, caught by a strict-mode Playwright error, not
  by reasoning:** the new button's accessible name ("Edit style") and
  `AnnotationToolbar`'s existing one ("Style") both exist in the DOM at
  once the instant a one-shot tool's shape is left selected (every tool
  here) - fine as distinct exact names, but `tests/e2e/annotationSettings.spec.ts`'s
  own `settingsButton` helper queried `getByRole('button', { name: 'Style' })`
  *without* `exact: true`, and Playwright's non-exact name matching is
  substring-based, so "Style" matched "Edit style" too. Fixed by adding
  `exact: true` to that one pre-existing helper - the two buttons' names are
  fine as they are, this was purely a test-selector fix.
- **Text's white halo (from part 2, above) replaced with a soft
  drop-shadow** (`TEXT_SHADOW_COLOR = 'rgba(0, 0, 0, 0.45)'`,
  `TEXT_SHADOW_BLUR = 6`, `TEXT_SHADOW_OFFSET_Y = 2` in `render/text.ts`,
  via `ctx.shadowBlur`/`shadowOffsetY` around a single `fillText` - no more
  `strokeText` pass at all). The halo had been chosen over a shadow in
  part 2's own live comparison, but that comparison was judged on a
  synthetic gradient backdrop; seeing the halo on real screenshot content
  this session, the user judged it "cheap-looking, like a plain stroke."
  Compared three options again, properly this time - a thinner halo, the
  original halo, and a soft shadow - via a throwaway self-contained
  HTML/canvas comparison page (`scratch-text-treatment-comparison.html`,
  repo-root, untracked, not committed - delete it or leave it, it's
  disposable) rendering all three across a busy gradient, a light UI-style
  screenshot, and a photo-like backdrop, using the app's own exact canvas
  primitives (`ctx.strokeText`/`ctx.shadowBlur`, not CSS `text-shadow`) so
  the comparison wasn't itself misleading about what would actually render.
  **User's call: the soft shadow.** Not scaled by font size (unlike the
  halo's stroke width) - a shadow's softness doesn't need to track glyph
  size to keep reading correctly across `ANNOTATION_SIZE_RANGE.text`, and
  `STYLE_PRESETS`' own image-shadow values (card/soft) are fixed regardless
  of image size for the same reason. Verified at both 1x preview and a real
  3x download (not just visual inspection at 1x) that the shadow scales
  sensibly rather than reading thinner/thicker relative to the enlarged
  text - it does, matching the existing image-shadow code's own established
  (and already cross-engine-tested) use of the identical `ctx.shadowBlur`
  mechanism.
- **Investigated and closed: the deployed Thai text is not falling back to
  a system font - it really is Anuphan, verified by a pixel-diff, not just
  re-reading the CSS.** The user's report: on the live site, Thai text
  annotations render in a font with no "hua" (the loop/curl Thai
  consonants like ก/ถ/ภ traditionally carry) - looked like a fallback, not
  the "premium" pairing item 3 of Phase 4 built. Checked for real against
  the live URL: `document.fonts` shows both faces `status: "loaded"`
  (200 responses for both `.woff2` files, confirmed via a real Playwright
  session against `https://snapboard.kaomatumaraiwa.com`, not just reading
  the bundler output) - so the font *is* loading. The decisive check:
  rendered the same Thai string three ways on the live page - through the
  app's actual `"Snapboard Annotation"` family, through Anuphan's own
  `.woff2` loaded directly under a distinct throwaway `FontFace` name, and
  through the plain system-font fallback stack - and diffed the resulting
  `getImageData` pixel buffers. The app's rendering and the directly-loaded
  Anuphan came back **byte-for-byte identical** (`diff: 0`); both differed
  hugely from the system fallback (`diff: ~350000`). Conclusion: this is
  Anuphan's own genuine type design - a modern, loopless Thai letterform
  style, a real and increasingly common design choice for contemporary Thai
  UI fonts - correctly loading and correctly applied, not a bug. (Separately,
  the throwaway comparison page built for the halo-vs-shadow decision above
  used a generic system-font stack rather than the real Anuphan/Inter
  @font-face, which is why *that* page's Thai sample looked different from
  the live site - a limitation of that one comparison tool, not evidence of
  anything wrong with the deployed app.) Not to be re-raised as a
  font-loading bug; a *preference* for a looped Thai font instead would be
  a new, separate design decision, not something this investigation itself
  calls for.

### Phase 5 annotation revision, part 2 — done: two part-1 bugs fixed, halo added
**(The halo this section describes was replaced by a soft drop-shadow later
the same day - see "Real-usage feedback round 2" above. Left unedited here
as the historical record of why a halo was tried first.)**

Built this session, shipped as commit `b6f1d5c`, pushed to `main`, and
deployed to the live site. Push and deploy both worked cleanly on the first
try; the `gh-pages` branch's own last commit reads `Deploy b6f1d5c`
(confirmed via `git fetch origin gh-pages` + `git log`, not just the deploy
script's own "Published." message) and a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`. The
custom domain briefly kept serving the previous bundle hash right after -
the standing CDN-cache caveat (see "Live site status" below), not a deploy
failure. `npm run verify` green (typecheck + 228 unit + 27 renderer parity
on 3 engines + 244/249 e2e passed, 5 skipped by design, same 5 as always) -
same counts as part 1 shipped with, since neither the two bug fixes nor the
halo needed a new test: the existing e2e suites already drive both code
paths and kept passing.

- **Both bugs came from the user actually using part 1's own feature on the
  live site, not from re-reading the code** - worth remembering as a
  pattern: a feature can pass every automated check (part 1 shipped with 15
  new e2e cases, all green on all 3 engines) and still have a real
  first-five-minutes usability bug, because the tests exercise the
  documented interaction (arm tool → open settings → change color → draw),
  not the interaction a user tries first (arm tool → draw → *then* try to
  change something).
- **Bug 1 - the Style/settings button disabled itself the moment it was
  needed most.** Every annotation tool is one-shot: drawing one shape
  commits it and reverts `tool` to `'select'` immediately (documented
  behavior since Phase 4 item 1). `AnnotationToolbar`'s settings button was
  `disabled={armed === null}`, where `armed` was `null` whenever
  `tool === 'select'` - so the instant a user drew their first shape (the
  natural thing to try before hunting for a settings button), the button
  that would let them change its color/size went dead. The user's own
  description - "the button shows up but pressing it does nothing" - is
  literally what a disabled button does; reproduced directly with a
  Playwright script that armed Arrow, drew one arrow, then checked
  `settingsButton.isDisabled()` - `true`, confirming the mechanism before
  touching any code. Fixed with a new `lastArmedTool` state in
  `AnnotationToolbar.tsx`: a `useEffect` records `tool` every time it's
  something other than `'select'`, and a new `settingsTool = armed ??
  lastArmedTool` derived value feeds the button's `disabled` check, the
  swatch preview, and the popover's props everywhere `armed` used to. The
  popover no longer force-closes when `tool` reverts to `'select'` either
  (that effect existed specifically because the old code assumed there was
  "nothing left to control" at that point, which is exactly the assumption
  this fix overturns) - it now closes only the normal way, via outside
  click, Escape, or the settings button itself, same as `ExportMenu`. Several
  throwaway Playwright scripts were written and discarded chasing this (not
  committed) - across Chromium/Firefox/WebKit and dev vs. production
  builds, confirming the exact color-picking flow the e2e suite already
  covers really does work standalone - before landing on the one repro that
  actually needed no popover interaction at all, just drawing first. Worth
  remembering if a similarly "invisible" bug report comes in again: try the
  interaction in the order a first-time user would, not the order the
  feature's own e2e spec does.
- **Bug 2 - scrolling the wheel to adjust size had no feedback unless the
  popover happened to already be open.** `BoardCanvas.tsx`'s wheel handler
  already called `adjustToolSize` correctly (part 1's own e2e case for this
  passed); the gap was purely visual. Fixed with a new transient
  `.annotation-size-hint` badge - `flashSizeHint()` reads the just-updated
  size straight from `useBoardStore.getState()` (not the subscribed
  `toolSettings` variable, whose closure inside the wheel effect only
  refreshes when `tool` itself changes, not on every wheel tick of the same
  tool) and shows it near the toolbar for 1.2s per scroll.
- **Neither bug fix touched `boardStore.ts` or any render code** - both were
  UI-only (`AnnotationToolbar.tsx`, plus the new hint state/element in
  `BoardCanvas.tsx` and its CSS), which is why `npm run verify`'s counts
  didn't move: the existing `annotationSettings.spec.ts` (15 cases, part 1's
  own suite) already exercises the color/size-change mechanics themselves
  and kept passing unchanged: what it didn't cover was the *post-draw*
  path, which is exactly what was broken. No new test was added for either
  fix - a defensible gap, not an oversight: it was deliberately left for a
  future pass rather than expanding scope further after two unplanned bug
  fixes already ahead of the planned part 2 work.
- **The halo itself: `drawText` in `render/text.ts` now strokes each line in
  a fixed near-white (`rgba(255, 255, 255, 0.9)`) before filling it**, width
  scaling with font size (`Math.max(2, Math.round(fontSize * 0.15))`) so it
  stays proportional across the full `ANNOTATION_SIZE_RANGE.text` range
  (14–40px), not just the default. Fixed, not user-configurable and not
  derived from the board's background or the editor's OS theme - the same
  "board content, not chrome" reasoning that already keeps `--annotation`
  and the checkerboard tokens out of dark mode's token group (Phase 5 item
  1's note): a label meant to be read off a screenshot of arbitrary content
  can't take its cue from the *editor's* theme. Harmless on a plain white
  background (the halo simply disappears where a red fill alone already
  read fine) and is what actually rescues legibility on a photo or gradient
  one - which is the whole point.
- **Font pairing: compared three real OFL-licensed candidates live, not just
  by description** - the current Inter (Latin) + Anuphan (Thai) pairing,
  IBM Plex Sans + IBM Plex Sans Thai, and Poppins + Sarabun. Downloaded all
  three's actual font files (IBM's from its GitHub releases, Poppins/Sarabun
  from the `google/fonts` OFL directory - each verified against its own
  `OFL.txt` before use), built a throwaway HTML/canvas comparison page
  rendering English and Thai sample text in all 3 pairings × 3 treatments
  (plain/shadow/halo) against a busy gradient backdrop (deliberately not a
  flat color, to actually stress-test legibility), and screenshotted it for
  a real side-by-side rather than describing fonts in the abstract. **User's
  call: keep Inter+Anuphan, use halo, not shadow** - Inter already
  approximates SF Pro's proportions (part of why it was picked originally),
  and halo read as unambiguously closer to macOS Markup's own look than the
  softer drop-shadow in every side-by-side. Since the font itself didn't
  change, **no new font files, no new OFL license doc, and no `styles.css`
  `@font-face` changes were needed** - this made the whole item cheaper than
  CLAUDE.md's own note anticipated ("whatever font is picked needs an OFL
  license... same as the current pair"), since nothing was actually picked
  to replace the current pair.
- **Real, pre-existing gap found while trying to validate the halo with
  `npm run test:render`, worth remembering before relying on that suite for
  *any* annotation-related change:** its 5 fixture scenes
  (`tests/render/render.spec.ts`'s `SCENES`) are pure image boards - none of
  them include an arrow/box/text/marker/redact node, and have not since
  Phase 4 introduced those node kinds. So "27/27 passed" after the halo
  change is real and correctly green, but it is not evidence about text
  rendering specifically - it only reconfirms the pre-existing
  image-tile-compositing checks still pass, which is a narrower claim than
  CLAUDE.md's own part-2 planning note assumed ("text-rendering/
  antialiasing differences between engines are exactly what invariant 1
  exists to catch"). The actual cross-engine confirmation for the halo came
  from `tests/e2e/text.spec.ts`'s existing 15 cases (5 × 3 engines), which
  do exercise real halo-rendered text and passed on all three. Extending
  the render-parity harness to include annotation-node scenes would close
  this gap properly but is real, unplanned work - noted here rather than
  done in passing, since it applies to all five annotation kinds, not just
  text.
- **Deliberately not done, scoped to exactly the two bugs plus the halo:**
  no persistence of `lastArmedTool` across a reload (same "UI preference,
  not board content" reasoning `toolSettings` itself already got in part
  1); no size-hint equivalent for color changes (color changes are already
  visible immediately - the armed tool button's own background swaps live -
  so there was nothing invisible to add feedback for); no attempt to extend
  the render-parity harness (see the gap above - real, but out of scope for
  this item specifically).

### Phase 5 annotation revision, part 1 — done: color + size for every tool

Built this session, shipped as commit `26c6761`, pushed to `main`, and
deployed to the live site. `npm run verify` green (typecheck + 228 unit +
27 renderer parity on 3 engines + 244/249 e2e passed, 5 skipped by design,
same 5 as always - the new `tests/e2e/annotationSettings.spec.ts` added 5
cases × 3 engines = 15, all passed on the first run, no new skips). Push
and deploy both worked cleanly on the first try; a same-session
`curl -o /dev/null -w '%{http_code}'` for `/` returned a fresh `200`. Also
manually verified in a real
browser via a throwaway Playwright screenshot script (not committed) -
the popover positions correctly above the bottom-left toolbar, swatch
selection and the size slider both work, and redact's popover correctly
shows no size row.

- **New shared module, `src/board/model/annotationDefaults.ts`** - the
  7-color palette (`ANNOTATION_COLORS`, red `#dc2626` first/default, per
  the user's approved list), the `Tool`/`AnnotationTool`/
  `SizableAnnotationTool` type aliases (previously an inline union repeated
  three times across the codebase), and `ANNOTATION_SIZE_RANGE` - the
  min/max/default for arrow/box's stroke width, marker's diameter, and
  text's font size, carrying forward the exact numbers each tool already
  shipped with (`ARROW_STROKE_WIDTH=4`, `BOX_STROKE_WIDTH=3`,
  `MARKER_DIAMETER=36`, `TEXT_FONT_SIZE=22`) so an existing board renders
  identically. Deliberately its own file, not `model/types.ts` - `types.ts`
  is imported *by* the render files (`renderScene.ts` etc.), so putting the
  size range there and having e.g. `arrow.ts` import its own default back
  out would have created a circular import; this module has no dependents
  of its own, so both model and render layers can depend on it safely.
- **Redact's real default is `#000000`, not the palette's "black" swatch
  (`#111827`) and not `DEFAULT_ANNOTATION_COLOR` (red)** - the one
  deliberate exception, and worth remembering before touching this again.
  `tests/e2e/redact.spec.ts` reads back the exported pixel under a
  never-recolored redaction and asserts `[0, 0, 0, 255]` as proof the
  content is unrecoverable; switching the untouched default to red or to
  the slightly-off-black palette swatch would have broken that proof
  silently. `REDACT_DEFAULT_COLOR` (`src/board/render/redact.ts`) is the
  named constant for this - the redact color *picker* still offers the same
  7-swatch palette as every other tool for UI consistency, so picking
  "black" from it deliberately gives `#111827`, not pure black; only the
  factory-default, never-touched value has to stay `#000000`.
- **Model change:** `ArrowNode`/`BoxNode`/`TextNode` gained a `size: number`
  field (stroke width, stroke width, font size respectively); `RedactNode`
  gained `color: string` (it had none at all before, by design - see item
  5's own note - this reopens that only as far as approved: a fill color
  choice, still fully opaque, no opacity dial, so the see-through-redaction
  risk item 5 was scoped to avoid still doesn't exist). `MarkerNode` needed
  **no new field** - its diameter was already fully encoded in `frame.w`/`h`
  (see `drawMarker`'s own note on deriving radius from `frame.w`), so only
  `markerFrame`'s call site needed to take a diameter parameter instead of
  reading the old module constant. Every node's `color` field is plain
  `string`, not the 7-value literal union `AnnotationColor` - same
  reasoning the Slate-background removal already established: stored data
  must decode fine even if a future palette change removes a swatch a
  board was actually saved with.
- **Render functions were already parameter-shaped for this, mostly.**
  `strokeArrow`/`strokeBox` already took `color`/`lineWidth` as parameters,
  not module constants - only their call sites (`renderScene.ts`,
  `BoardCanvas.tsx`'s drag-preview) needed to switch from the old
  `ARROW_STROKE_WIDTH`/`BOX_STROKE_WIDTH` constants to a per-node or
  per-tool-setting value. `fillRedact` gained a `color` parameter it never
  had. `drawText`/`textFont`/`textHeight` needed real threading, not just a
  call-site change - font size affects wrapping math, so `TEXT_FONT_SIZE`
  and the derived `TEXT_LINE_HEIGHT` constant both had to become parameters
  (`textFont(fontSize)`, the new `textLineHeight(fontSize)` function,
  `textHeight(lineCount, fontSize)`) - the one tool that needed more than a
  call-site swap.
- **New store state, `toolSettings`** (`src/board/store/boardStore.ts`) -
  per-tool `{ color, size? }`, seeded from `ANNOTATION_SIZE_RANGE`'s
  defaults (redact from `REDACT_DEFAULT_COLOR`, see above). Deliberately
  **not** part of `Board` and **not** autosaved or undo/redo-tracked - same
  "what to draw next, not arranged content" reasoning `selectedIds`/camera/
  export options already established; picking a color for the *next* arrow
  doesn't need to survive a reload or be undoable any more than the camera
  position does. `setToolColor`/`setToolSize` (clamped via
  `clampAnnotationSize`) and `adjustToolSize` (a relative nudge, for the
  wheel) are the three new actions. `addArrow`/`addBox`/`addMarker`/
  `addRedact`/`commitText`'s create branch all now read `s.toolSettings.*`
  instead of the old hardcoded `DEFAULT_ANNOTATION_COLOR` - a text re-edit
  still leaves an existing node's `color`/`size` untouched, same as before.
- **Scroll-wheel handling** (`BoardCanvas.tsx`'s existing wheel effect,
  previously pan-or-zoom-only): ctrl/cmd+wheel still zooms even while a
  tool is armed (so the user can zoom in for precision without backing out
  of the tool first); otherwise, while a *sizable* tool (arrow/box/text/
  marker - not redact, which has no size dimension, not `'select'`) is
  armed, a plain wheel nudges that tool's size by 1 instead of panning.
  One step per wheel *event*, not per `deltaY` unit, so a fast trackpad
  flick just means more events, which already reads as faster - no extra
  velocity math needed.
- **"Live preview while dragging" needed no new plumbing for arrow/box/
  redact** - `drawInteraction`'s existing draft-preview code already calls
  `strokeArrow`/`strokeBox`/`fillRedact` on every pointermove using
  whatever `toolSettings` currently holds (now a subscribed store value in
  `BoardCanvas`, added to `drawInteraction`'s `useCallback` deps); since
  React re-renders the component whenever `toolSettings` changes,
  scrolling the wheel *while mid-drag* (not just before starting one)
  already picks up the new size/color on the very next paint, for free.
- **New popover, `src/ui/AnnotationSettingsPopover.tsx`** - same
  `position: fixed`-anchored-from-a-real-`getBoundingClientRect()` pattern
  `ExportMenu` established, but anchored *upward* (`bottom`/`left`, not
  `top`/`right`) since `AnnotationToolbar` lives at the bottom of the
  viewport, not inside a scrolling top bar. Opened from a new trailing
  settings button in `AnnotationToolbar.tsx` (a colored dot matching the
  armed tool's current color), disabled while `tool === 'select'` - there's
  no tool context to adjust yet, matching this revision's own "while a tool
  is armed" framing. The popover closes and reopens correctly on repeat
  clicks of that same button (its outside-mousedown-close listener
  explicitly excludes the anchor button itself, so the button's own
  `onClick` toggle isn't fought by the popover trying to close itself first
  in the same click) and auto-closes if the tool ever reverts to `'select'`
  out from under it (committing an annotation, or Escape).
- **`.annotation-toolbar__btn.is-active`'s background is now set inline
  per-tool** (`toolSettings[tool].color`), not solely the fixed `--annotation`
  CSS token from item 1 - that token is still the *fallback* (kept in
  `styles.css` for before the inline style is set, and still deliberately
  unthemed - it's still previewing board content, not chrome), but the
  actual armed-tool color now varies with the user's choice, which a single
  CSS custom property can't express on its own.
- `tests/unit/marker.test.ts` and `tests/unit/text.test.ts` updated for the
  new required parameters (`markerFrame(point, diameter)`,
  `textHeight(lineCount, fontSize)`, `textLineHeight(fontSize)`);
  `tests/unit/boardStore.test.ts` gained a `toolSettings` block (defaults
  including redact's black exception, `setToolColor`/`setToolSize`
  clamping, `adjustToolSize` nudging and clamping at the edges, and that a
  newly created arrow/marker/text/redact actually picks up the currently
  armed color/size). `tests/e2e/annotationSettings.spec.ts` (new) covers
  the settings button's disabled/enabled state, the popover's contents for
  a sizable tool vs. redact's color-only version, that picking a color
  actually changes the next arrow drawn (a real green-pixel check, not just
  a DOM assertion), that scrolling the wheel while armed changes the
  displayed size live, and that the size slider actually changes drawn
  stroke thickness (measured by counting reddish pixels in a vertical
  scan-line through a box's stroke, before and after).
- **Deliberately not done, scoped to what "size + color" alone needs:** no
  persistence of `toolSettings` across a reload (a UI preference, not board
  content, same as export options); no color/size choice for anything
  beyond the five existing annotation kinds; no attempt to guarantee icon
  contrast against every one of the 7 swatch colors on the armed-tool
  button (e.g. white glyph on the yellow swatch) - not asked for, and every
  other design tool with a color-swatch button has the same trade-off.

### Phase 5 item 1 — done: design system cleanup

Built this session, shipped as commit `132126d`, pushed to `main`, and
deployed to the live site. `npm run verify` green.

- **The audit that preceded it found dark mode was already half-built, the
  same way Phase 3 found most of its own feature list already existed:**
  `styles.css` already had a 13-token `:root` and an
  `@media (prefers-color-scheme: dark)` block overriding 9 of them. The real
  gap was not "no tokens," it was **three status colors that had no dark
  value at all** - so item 1's scope was widened (with the user's explicit
  approval) to close that, which is what turns item 2 into a verification
  pass instead of a second edit of the same file.
- **The one decision this item actually made, and the reason to read this
  note before touching `styles.css` again: tokens are now split into two
  groups, and the split is load-bearing.** *Chrome* tokens follow the OS
  theme. *Board-content* tokens (`--annotation`, `--checker`,
  `--checker-base`, `--checker-image`) deliberately do **not**, and are
  absent from the dark-mode block on purpose. Collapsing the two would make
  the app's chrome and the exported image disagree about what the user is
  looking at, and would contradict manual-checklist E7's confirmed result
  ("UI chrome follows the OS theme, board background does not"). A naive
  "tokenize every literal" pass would have done exactly that - `.board-page`'s
  `#fff` and the transparency checkerboard look like chrome and are not.
- **Concretely, this is why `.text-edit` and `.annotation-toolbar__btn.is-active`
  use `--annotation` and not `--danger`,** even though all three were the
  same `#dc2626` literal before: the text tool's live textarea and the armed
  tool button are both *previewing the red that will be drawn on the board*.
  A dark-mode variant would make that preview lie. `.selection-toolbar__btn--danger`
  is the opposite case - a destructive-action affordance, pure chrome - and
  does get a dark variant. Same literal, three sites, two different meanings;
  that distinction is the whole point of the group split.
- **Three real contrast failures fixed, all of them measured rather than
  eyeballed** (the numbers matter because item 4's acceptance bar is
  Lighthouse a11y > 95):
  - `--warn` had no dark value, so the toast that reports a **rejected file**
    rendered `#b45309` on `#161b22` at **3.4:1** - below AA, on the one code
    path a user only ever sees when something has already gone wrong. Now
    `#fbbf24` in dark (10.4:1).
  - `.btn--done` (the "Copied" state of the primary button) kept
    `.btn--primary`'s white text over `#16a34a` - **3.58:1, failing AA in
    light mode already**, before dark mode was even considered. Now
    `--success-solid` `#15803d` (4.8:1). This is a deliberate, visible
    light-mode color change, not just a rename.
  - White `--accent-text` over the dark theme's `--accent` `#4c8dff` was
    **3.2:1** on the Download button.
- **That last one forced a token split worth knowing about:** in dark mode a
  blue bright enough to read *as text* on a dark surface is too light to
  *carry* white text on top of it. One token cannot do both jobs. Hence
  `--accent` (text, links, focus rings, borders) vs `--accent-solid` (the
  fill behind `--accent-text`); they're equal in light mode and differ only
  in dark. `--success`/`--success-solid` needed the identical split for the
  identical reason - `--success` borders a light toast so it can't be the
  bright green either.
- Duplication actually removed (the "cleanup" half of the item): the
  `color-mix(in srgb, var(--text) 7%, transparent)` hover tint was written
  out **5 times verbatim** and is now `--hover-tint`; the transparency
  checkerboard was **two near-identical 4-gradient stacks using two
  different grays** (`#c9cfd8` in the swatch, `#d7dce4` on the board page)
  and is now one `--checker-image` - the board page's checkerboard is
  consequently slightly darker than before, which is a visible change and
  the better default (more contrast reads as "transparent" more clearly).
  Also added `--radius-sm`, `--control-h`, `--bar-pad`, `--text-sm`,
  `--text-xs` for values repeated 4-8 times each across the four
  pill-shaped control groups - item 10 (mobile) is what will actually need
  to scale those, which is why they exist now rather than later.
- **No full spacing scale, on purpose.** Rewriting every `padding`/`gap` in
  a 700-line file into a `--space-N` ladder would churn every rule for no
  present caller; the five tokens above are the ones with 4+ real duplicate
  sites today. Add more when a caller needs them.
- `renderScene.ts`'s badge colors are now named (`BADGE_FILL_COLOR`,
  `BADGE_TEXT_COLOR`, `BADGE_RING_ON_TRANSPARENT`) instead of inline
  literals. They are board content, so this is *not* a step toward wiring
  them to CSS tokens - the names exist specifically so the next reader
  doesn't "fix" `#2563eb` into `var(--accent)` because the two share a value
  today. `tests/render/render.spec.ts:54` asserts the badge is blue, so that
  mistake would be caught, but only on the parity suite.
- **Nothing else in `src/` needed to change and no test needed updating** -
  no e2e or unit test asserts on a chrome color (checked before editing);
  the only color literals tests do reference are the annotation red and the
  badge blue, both of which are unchanged by design.
- **Deliberately not done:** no theme toggle (item 2's call, if it wants
  one - `prefers-color-scheme` alone is what E7 confirmed works); no
  `@media (max-width)` rules (that's the approved pre-item-3 overflow work,
  next); no a11y changes beyond the contrast values above (`role="group"` on
  the chip groups and `ExportMenu`'s missing focus trap were both found
  during the audit and belong to item 4 - see the Phase 5 list below).

### Phase 5 item 2 — done: dark mode (verification pass)

Built this session, shipped as commit `87fd9df`, pushed to `main`, and
deployed to the live site. `npm run verify` green. Push and deploy both
worked cleanly on the first try; a same-session `curl -o /dev/null -w
'%{http_code}'` for `/` returned a fresh `200`.

- **No theme toggle** - `prefers-color-scheme` alone stays the only
  mechanism, confirmed by re-reading item 1's own note and manual-checklist
  E7. Nothing in this session's audit turned up a reason to add one.
- **Verification method, not eyeballing:** launched the real app under
  Playwright with `colorScheme: 'dark'` emulation (the same mechanism a real
  OS dark-mode setting triggers) and walked through every chrome surface
  item 1's audit named - empty state, the warn toast, the board with images,
  the selection toolbar, the export menu popover, an armed annotation tool
  (arrow and redact, both using the deliberately-unthemed `--annotation`
  preview color), the text-edit overlay, the Copy→"Copied" button, the
  free-layout banner, and the cleared-board bar. Screenshotted each one, and
  for the two that looked suspicious in the screenshot, followed up with a
  `getComputedStyle` + `getImageData` probe to get an exact contrast ratio
  instead of judging by eye - the same "measured, not eyeballed" standard
  item 1 set for its own three contrast fixes.
- **Real bug found and fixed, independent of dark mode but only ever
  surfaced by actually looking at the hover state right after a real
  click:** `.btn--done` (Copy's "Copied" confirmation, item 1's `--success-solid`
  fix) was losing to `.btn--primary:hover:not(:disabled)` in the cascade -
  the hover rule has three selector components (class + `:hover` +
  `:not()`) against `.btn--done`'s one, so it always won regardless of
  source order. Since the pointer is still sitting on the button the instant
  it flips to "Copied" (that's literally what the user just clicked), this
  wasn't an edge case - it was the *common* case, and it silently repainted
  the confirmation back to a darkened accent blue, in both themes, the whole
  time item 1 believed the green fix was shipped. Confirmed via a
  `getImageData` pixel probe: `rgb(21,128,64)` (`--success-solid`) with the
  pointer elsewhere, `color(srgb 0.107 0.383 0.811)` (mathematically exactly
  88% of dark-mode `--accent-solid` toward black - the hover formula) with
  the pointer on the button. Fixed with one added rule,
  `.btn--done:hover:not(:disabled) { background: var(--success-solid); }`,
  matching the winning rule's specificity so source order (declared after)
  decides it correctly. See `src/app/styles.css`'s `.btn--done` comment.
- **Real gap found, deliberately not fixed here - handed to item 5
  instead:** the text-edit overlay (`.text-edit`, live-typing background)
  measures at **2.64:1** contrast in dark mode via the same pixel-probe
  method (composited `--surface` at 70% opacity over the actual underlying
  image pixel at a real click point, against the fixed `--annotation` red
  text). That's below AA - but the *same* probe against light mode measured
  **3.20:1**, also below AA. This is a pre-existing legibility gap in both
  themes, not something dark mode introduced or made qualitatively worse
  (2.64 vs 3.20 is the same failure, not a new one), and the overlay is a
  live-editing affordance, not the final render (export draws the same red
  via plain `fillText`, no background box, per invariant 1) - so it doesn't
  belong to "verify dark mode follows the rules," it belongs to item 5's
  accessibility pass, which already owns two other contrast-shaped findings
  from item 1's audit. Noted here so item 5 doesn't have to rediscover it.
- **Everything else checked out clean:** the chip groups' pressed/hover
  states, the annotation-toolbar armed-tool red highlight (arrow and redact
  both checked), the export menu popover's format/size controls and pixel
  estimate text, the warn toast (`#fbbf24` on `#161b22`, item 1's own fix),
  the free-layout banner's blue link, the selection toolbar and its
  duplicate/front/delete/crop icons, and the cleared-board bar's "Restore"
  link all rendered with the same contrast item 1 measured for light mode -
  no new dark-mode-only regression turned up in any of them.
- **Deliberately not done:** no changes to the board-content token group
  (`--annotation`, `--checker*`) - re-confirmed correct by this pass, not
  touched, per item 1's own rule that they must never follow the OS theme.
  No `@media (max-width)` work - that's item 3, next. No fix for the
  text-edit contrast gap above - that's item 5's, and fixing it here would
  have meant deciding item 5's approach (a fixed high-contrast backing vs.
  changing the annotation color's dark-mode behavior) without having done
  item 5's own audit first.

### Phase 5 item 3 — done: top-bar overflow fix (plus a batch of real-usage feedback fixes)

Shipped as commit `aebdbd2`, held un-pushed for one session per the user's
explicit instruction to commit and update this Guide, then continue in a
fresh session - **pushed to `main` and deployed to the live site in the
next session (2026-09-13)**, on the user's approval, as that session's first
action. `npm run verify` green (typecheck + 218 unit + 27 renderer parity on
3 engines + 229/234 e2e passed, 5 skipped by design, same 5 as always). This
came from the user actually using the deployed live site and reporting back
what felt wrong - four of the five things below aren't on the planned
Phase 5 list at all, they just happened to touch the same files as item 3
so they shipped together.

- **Real bug, not a design choice: annotations were forcing the whole
  board to `layout: 'free'`.** The user asked "why does drawing an arrow
  disable the Gap slider" and it turned out to be a genuine bug, not
  intentional - `addArrow`/`addBox`/`commitText`/`addMarker`/`addRedact`
  in `boardStore.ts` all set `layout: 'free'` on the node-add commit,
  copied from `setFrames`'s reasoning (a manual image move/resize
  correctly must freeze auto-layout, invariant 4) without noticing that
  reasoning doesn't apply to annotations at all - `relayout()` only ever
  rewrites `kind === 'image'` frames and passes every other node through
  untouched (see its own updated comment), so an annotation coexisting
  with an `'auto'`/`'rows'`/etc. board was never actually a problem for
  the layout algorithm. Fixed by dropping `layout: 'free'` from all five
  call sites - images keep auto-arranging exactly as if the annotation
  weren't there.
- **Second real bug, only surfaced by fixing the first one:** with layout
  no longer frozen, dragging an annotation on an auto-arranged board fell
  into Phase 2 item 5's drag-to-reorder path (`BoardCanvas.tsx`'s
  `if (board.layout !== 'free')` branch), which assumes every draggable
  node is an image with a meaningful "order" position to drop onto -
  untrue for an arrow/box/text/marker/redact, which were never part of the
  order/reorder system to begin with. All 3 e2e engines failed identically
  on `redact.spec.ts`'s move test the first time `verify` ran after the
  first fix, which is what caught this - not spotted by reasoning alone.
  Fixed by gating that branch on `hitNode.kind === 'image'` too - an
  annotation now always gets a direct move, whether the board is `'auto'`
  or `'free'`.
- **Background "Slate" swatch removed** - the user found it visually
  indistinguishable from White in practice. Removed from `BACKGROUNDS`
  (`types.ts`), `SWATCHES` (`TopBar.tsx`), and the `background.slate` i18n
  string. Backward compatible with no extra code: a board's `background`
  field stores the actual color value (`{ type: 'solid', color: '#eef2f7' }`),
  not a name reference to the removed key, so an old autosaved/last-cleared
  board that used Slate still decodes and renders correctly - it just won't
  show any swatch as pressed anymore, which is cosmetic only.
- **Gap slider now shows a live percentage** (`spacing.gapWithPercent` in
  `en.ts`, `Gap · {{percent}}%`) computed as `gap / GAP_MAX` where
  `GAP_MAX` is the slider's own 80px range - one denominator, so the label
  and the slider's range can never drift apart. Default dropped from 20px
  to **6px (~7.5%)** per the user's explicit "5-10% is enough to see the
  gap" preference.
- **`.topbar` now scrolls horizontally instead of squishing controls below
  legible size** once they don't fit - the mechanism behind the standing
  "top bar needs horizontal scrolling on mobile" manual-checklist finding
  (Gate section below). `overflow-x: auto` on `.topbar` plus
  `flex-shrink: 0` on its direct children (except `.spacer`, whose own
  later `flex: 1` rule still wins for itself, so it keeps collapsing first
  as before) - nothing shrinks illegibly before the bar itself starts
  scrolling. This is **not** all of item 11 (mobile lite) - just the floor
  so item 4 (6 gradient backgrounds, which grows the swatch row from 4
  controls to 10) doesn't make a known finding worse. (Item 4 ended up
  moving the background picker to a popover instead of growing the inline
  row at all - see its own note under START HERE - but the reasoning here
  for building the overflow floor first still holds.)
- **That overflow fix nearly broke the Phase 3 export options popover, and
  is the one part of this batch worth remembering in detail:** `overflow`
  on any ancestor clips absolutely-positioned descendants regardless of
  which element is their *positioning* ancestor - `overflow` and
  `position`'s containing-block chain are two independent things. Once
  `.topbar` got `overflow-x: auto`, `ExportMenu`'s `.export-menu`
  (`position: absolute` inside `.split-btn`, itself a child of `.topbar`)
  would have started getting silently clipped by the bar's own bounding
  box the instant it dropped below the header's 52px height - never
  caught by any existing test because none of them assert on the popover's
  *visual* position, only on `.export-menu`'s existence/contents. Fixed by
  switching it to `position: fixed`, with `top`/`right` computed in a
  `useLayoutEffect` from the caret button's real `getBoundingClientRect()`
  (passed in as a new `anchorRef` prop) - `position: fixed` elements aren't
  clipped by an ancestor's `overflow` unless that ancestor establishes its
  own fixed-position containing block (via `transform`/`filter`/
  `will-change`/etc.), which nothing here does. Also closes it on scroll
  of the now-scrollable bar (`TopBar.tsx`'s new scroll listener while the
  menu is open), since a `position: fixed` popover would otherwise
  visually detach from a caret button that just scrolled out from under
  it. Worth remembering for any future popover anchored inside `.topbar`.
- **Deliberately not done:** no `@media (max-width)` rules and no other
  mobile-shaped layout changes - that's the rest of item 11, later. No
  fix to the five things above beyond what's described - each is scoped
  to exactly what was reported, not a broader pass over its area.

### Phase 4 item 6 — done: crop (per-image, not the whole board)

Built this session, on top of item 5 (redact) which had been sitting done
but uncommitted since the prior session - both shipped together in one
commit (`1276962`), pushed to `main`, and deployed to the live site, per the
user's explicit go-ahead this session. Full detail lives in
[docs/phases/phase-4.md](docs/phases/phase-4.md); the highlights:

- **The first thing this item needed was a scope question, not code:**
  CLAUDE.md's own item-6 line said "crop the board itself," but the product
  plan's data model (§7.3's `ImageNode.crop?: Rect`, normalized 0..1) and its
  §4.2 mockup (crop lives in the floating per-object toolbar - `[ครอบตัด]
  [ทำซ้ำ][ขึ้นหน้า][ลบ]` - that appears when *one object* is selected) both
  describe a **per-image** crop, not a whole-board one. Asked the user, who
  confirmed per-image is correct - CLAUDE.md's phrasing was simply imprecise,
  not a deliberate redirection of scope.
- **UX is a classic crop tool, not a resize handle repurposed:** the
  SelectionToolbar's new Crop button (shown only when exactly one image node
  is selected) opens a session showing the *entire* uncropped source image,
  dimmed outside the current crop window, with 4 free (non-aspect-locked)
  corner handles to drag - confirm (Done/Enter) commits, cancel
  (Cancel/Escape) discards. The session is modal: every other click/keyboard
  shortcut is a no-op while it's open, so a stray Delete/D/F can't touch the
  node being cropped.
- **A new third canvas** (`.board-crop-overlay`) draws the dimmed full image
  + handles, kept separate from `.board-interaction` specifically so image
  content never mixes into the plain selection-UI canvas the existing e2e
  pixel-scanning tests already assume is otherwise empty.
- **A real correctness bug caught by reasoning, not by a test:** `relayout()`
  fed `computeLayout` the source image's full natural size for aspect-ratio
  purposes, even for a cropped node - turning auto-layout back on after
  cropping would have recomputed a frame sized to the *uncropped* aspect
  ratio while `crop` still only showed a sub-rect, stretching it. Fixed by
  using the cropped natural size (`natural.w * crop.w`, `natural.h *
  crop.h`) when a node has a `crop`. Not independently unit-testable through
  `boardStore`'s existing test conventions (its tests never touch a real
  `assetStore` asset, only the `{w:16,h:9}` fallback), so this one is
  protected by code review and type-checking, not a new assertion - worth
  remembering if a future feature needs to exercise this path for real.
- `RenderItem.crop` and the tile-cache key both had to change together
  (invariant 2 - crop is now a fourth dimension, alongside size/style/ratio,
  that must invalidate a tile) but invariant 1 (one renderer for preview and
  export) needed no new code at all - crop is just an extra parameter on the
  same `drawFramedImage` both paths already shared.
- `tests/unit/crop.test.ts` (8 cases, the crop-window geometry directly),
  `boardStore.test.ts`'s `commitCrop` block (4 cases), `tests/e2e/crop.spec.ts`
  (5 cases × 3 engines = 15, including a real shrink-then-export-then-
  sample-the-uncovered-pixel check) - all passed on every engine on the first
  run, no new skips.
- **Deliberately not done:** panning the crop window without resizing it (4
  corner handles already cover "trim excess from any edge," which is all the
  product plan's "สกรีนช็อตมักมีส่วนเกิน" line asks for), aspect-ratio locking
  or presets (crop must trim each edge independently, the opposite of what
  image resize's aspect lock is for; no preset is asked for anywhere in the
  product plan either).

### Phase 4 item 5 — done: redact (solid fill only)

Shipped in the same commit (`1276962`), push, and deploy as item 6 above -
see that note for why the two went out together.

- **Scoped to solid fill only before any code was written** - the user
  explicitly cut blur and pixelate ahead of implementation, not as a
  discovered simplification. This sidesteps the product plan's own risk
  note almost entirely: a light blur can be reversed, and pixelate needs an
  enforced minimum block size to stay safe, but solid fill has no
  "how strong" dial at all - the covered pixels are simply never drawn, so
  there is no reversibility spectrum to get wrong.
- A floating "Redact" tool button in the same bottom-left
  `AnnotationToolbar` (icon: `■`, a filled square - visually distinct from
  box's outline-only `▢`), plus a plain `C` keyboard shortcut (for
  "censor" - the product plan's own Thai word is "เซ็นเซอร์"; `R` was
  already box's, `B` reads as "blur" which doesn't exist here). Same
  one-shot drag-to-draw shape as box: press once to arm, drag to draw,
  release to commit (or revert to `'select'` on a stray click); Escape
  while armed cancels without creating anything - all for free from the
  existing generic `tool !== 'select'` Escape handler and drag-vs-click
  threshold pattern, no new branching needed.
- `RedactNode` (`src/board/model/types.ts`) mirrors `BoxNode` almost
  exactly - `frame` is the actual dragged rectangle, not a derived pad, so
  every generic frame-based helper (`setFrames` move, `duplicateSelected`'s
  offset-copy, `hitTest`, `handles.ts`'s resize-handle exclusion,
  `relayout`/`reconcileAssets`/`decodeBoardAssets`'s existing
  `kind !== 'image'` filters) needed zero new per-kind branches - same
  "box needed no new branches either" reasoning item 2 established, and
  the smallest diff of the five annotation kinds shipped so far for exactly
  that reason. **One deliberate difference from every other annotation
  kind: no `color` field.** Arrow/box/text/marker all carry a `color` that
  happens to be fixed to `DEFAULT_ANNOTATION_COLOR` today but exists as a
  field; giving redact one too would silently invite a future "let the user
  pick a semi-transparent redaction color" feature, which is exactly the
  see-through-redaction risk the whole item is trying to foreclose. The
  fill is instead a module-level constant, `REDACT_FILL_COLOR` (`#000000`,
  fully opaque) in the new `src/board/render/redact.ts`.
- `src/board/render/redact.ts` - `fillRedact`, a thin `ctx.fillRect` wrapper,
  called identically by `renderScene` (committed redaction, board-space,
  invariant 1) and `BoardCanvas`'s interaction-canvas preview (screen-space,
  while dragging) - same one-source-of-truth reasoning `strokeBox`/
  `strokeArrow` already established. Unlike those two, the preview and the
  final result are pixel-identical by construction (fully opaque black
  either way), not just structurally similar - there's nothing left to
  reveal once the drag commits.
- **Draw order matters here more than for any other annotation kind, and is
  the one real design decision this item made:** `renderScene` draws
  redactions immediately after the images and *before* boxes/arrows/
  text/markers, not after everything like markers are. Drawing them last
  (matching markers) would still visually cover the image today, but would
  be fragile - it would rely on "nothing else happens to render after
  redact" staying true forever. Drawing them right after images instead
  means a redaction is structurally *part of what's already on the board*
  before any other annotation is even considered, so a later arrow can
  still point at a redacted region or a marker can still number it, without
  ever risking something rendering on top that could make the cover look
  incomplete.
- `boardStore.ts`'s `addRedact(start, end)` mirrors `addBox` exactly
  (`rectFromPoints`, `layout: 'free'`, select the new node, revert
  `tool` to `'select'`). `toRenderInput` filters/maps it into
  `RenderInput.redacts` the same way boxes become `.boxes` - excluded from
  step-badge numbering, same as every other annotation kind.
- **The one test that actually matters for this item, beyond the usual
  parity with box's own suite:** Phase 4's Definition of Done specifically
  requires proving redacted content is unrecoverable "tested by zooming
  into the export, not just eyeballing the preview" - the other four
  annotation kinds' e2e specs only check `download.path()` is truthy for
  "survives export," which doesn't prove anything about content. This
  item's `tests/e2e/redact.spec.ts` adds a dedicated test that downloads
  the real exported file, decodes it through the browser's own PNG decoder
  (an `<img>` loaded from a `data:` URL, not a hand-rolled Node-side
  decoder - canvas-exported PNGs use real per-scanline filtering that a
  from-scratch decoder would have to reimplement correctly), and reads back
  the exact pixel under the redaction with `getImageData`. The fixture
  image's own gradient (see `png.ts`) fixes its blue channel at a constant
  180, so it can never coincidentally produce a pure-black pixel on its
  own - meaning a `[0, 0, 0, 255]` read back from the *downloaded file*
  is unambiguous proof the original content is gone, not just covered
  on-screen. The rest of the file (drawing survives export, the `C`
  shortcut, Escape-cancels, a stray click creating nothing,
  select→delete→undo, no resize handle) mirrors `box.spec.ts`'s structure
  directly. All 6 cases pass on all 3 engines with no skips needed.
- **Deliberately not done, scoped to what "solid-fill redact" alone
  needs:** no blur or pixelate modes (cut by explicit user decision before
  implementation, not a discovered gap - see above), no opacity/color
  choice (no `color` field at all, see above), no resize handle (move it,
  or delete and redraw - same as arrow/box/text/marker), no mode-switching
  UI of any kind (nothing to switch between with only one mode).

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
- **Confirmed conflict, not just a risk anymore:** Chrome/Edge bind
  `Ctrl/Cmd+Shift+C` to DevTools' inspect-element mode as a browser-chrome
  accelerator, not a page-level one - the user confirmed on a real desktop
  build that this app's `preventDefault()` does not stop it; DevTools wins.
  Headless Playwright has no DevTools UI, which is why this could only be
  caught by real-machine testing. Accepted as a known limitation, not
  something to keep chasing - there's no page-level way to override a
  browser-chrome-owned shortcut. Worth a caveat in the shortcut cheatsheet
  (Phase 5 item 8) so a user doesn't file it as a bug later.
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

## Live site status — up to date with all of Phase 4 (items 1–6: arrow, box, text, marker, redact, crop) and all of Phase 5 (items 1–9, item 10 cancelled, item 11 mobile lite mode): design system cleanup, dark mode, top-bar overflow fix + real-usage feedback fixes, 6 gradient backgrounds, accessibility pass, friendly error messages, right-click context menu, help modal / shortcut cheatsheet, animation / micro-interactions, and mobile lite mode - plus all 3 parts of the annotation revision (color + size for every tool, the text shadow treatment, and content-driven text sizing), "real-usage feedback round 2" (board auto-fit, order-independent row layout, edit-in-place annotation style, and the text shadow that superseded the halo), the third round of real-usage feedback (edit-style popover position, size-slider undo batching, text-overlay premature wrap), the mobile UX revision (settings popover so the top bar never scrolls, plus annotate-only tool support on mobile), and the unbounded-wheel-pan fix. **Phase 5 is functionally complete.**

**https://snapboard.kaomatumaraiwa.com** — GitHub Pages, `gh-pages` branch,
HTTPS enforced, certificate approved. Source push (`git push origin
master:main`) and `bash scripts/deploy-pages.sh` were last run together
right after the unbounded-wheel-pan fix's own commit (`2a023c4`, see the
START HERE note above), on the user's approval, and both worked cleanly on
the first try (no re-auth, no DNS re-check needed). Live site now serves all of
Phase 2 (items 1–9), the Clear board addition, Phase 3, the complete Phase 4
(items 1–6), all of Phase 5 (items 1–9, item 10 cancelled, item 11), all 3
parts of the annotation revision, real-usage feedback round 2, the third
round of real-usage feedback, the mobile UX revision, and the
unbounded-wheel-pan fix.
Deploy script itself reported success (`Published.` + the live URL); the
`gh-pages` branch's own last commit reads `Deploy 2a023c4` (confirmed via
`git fetch origin gh-pages` + `git log`, not just the deploy script's own
message) and a same-session `curl -o /dev/null -w '%{http_code}'` for `/`
returned a fresh `200`. (The
custom domain sits behind a CDN edge cache with a 10-minute
`max-age`, so a stale bundle hash can be observed for a few minutes right
after a deploy — not a deploy failure, just propagation - worth a re-check
next session if in doubt about the *bundle* specifically, as opposed to the
page. This kept happening again this round: the root `curl` came back `200`
immediately, but the bundle hash in the served HTML still matched the
*previous* build for a few minutes, while the `gh-pages` branch itself
already had the new one.)

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
  failed) - **skipped by explicit user decision (2026-09-13), not to be
  raised again.**
- **New finding, desktop-only testing so far:** on mobile, the top bar/toolbar
  requires horizontal scrolling to reach — awkward to use. Not filed as a
  Phase 2 item (user wants it noted, not built now); revisit when doing
  mobile-specific work, likely alongside or after Phase 5 polish. Keep this in
  mind if any Phase 2 UI (zoom controls, selection handles) adds more to that
  bar — it makes the overflow worse, not better.
- **Real Safari/Firefox confirmation (desktop and mobile) is also skipped by
  explicit user decision (2026-09-13)** - not to be raised again.

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
   Confirmed, not just a carried-forward risk: on a real desktop build,
   `Ctrl/Cmd+Shift+C` does lose to Chrome/Edge's DevTools inspect-element
   accelerator - untestable in headless Playwright, only caught by the user
   testing on a real machine. Accepted as a known limitation.

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
5. ✅ **Redact** - done — see "Phase 4 item 5" under START HERE above. Scoped
   down to solid fill only (no blur/pixelate) by explicit user decision - see
   that note for why.
6. ✅ **Crop**, per-image (not the whole board - see "Phase 4 item 6" under
   START HERE above for why that distinction needed asking the user first).

**Phase 4 is done when:** placing an arrow + number on a bug report takes
under 15 seconds · redacted content is verifiably unrecoverable from the
exported file (tested by zooming into the export, not just eyeballing the
preview) · the product plan's own Definition of Done (section 12) is met.
**All three are now true** - see [docs/phases/phase-4.md](docs/phases/phase-4.md)
for the full Definition of Done table and everything item 6 (crop) shipped.

## Phase 5 — Polish

Objective: per the product plan's own framing, make the app feel "premium,"
not "a free tool on the web." Unlike Phase 2–4, the product plan (§12) lists
Phase 5's features as a flat set with no prescribed build order and no
mockups for most of them - the order below is this guide's own judgment
call (each item still independently shippable, same as every prior phase),
made so later items can build on earlier ones instead of redoing them:

1. ✅ **Design system cleanup.** Done - see "Phase 5 item 1" under START
   HERE above. Read its note before touching `styles.css` again: tokens are
   now split into chrome (themed) and board-content (never themed) groups,
   and it closed three measured contrast failures, two of which were
   pre-existing in light mode.
2. ✅ **Dark mode.** Done - see "Phase 5 item 2" under START HERE above.
   Confirmed no theme toggle is wanted (E7 already settled that). The
   verification pass found and fixed one real bug (`.btn--done` losing to
   `.btn--primary:hover` in the cascade, in both themes) and found one gap
   deliberately deferred to item 5 (the text-edit overlay's contrast, which
   fails AA in *both* themes and predates dark mode).
3. ✅ **Minimum top-bar overflow fix.** Done - see "Phase 5 item 3" under
   START HERE above. `.topbar` now scrolls horizontally instead of
   squishing chips/buttons illegibly; this is **not** all of item 11
   (mobile lite) - just enough that item 4 below is safe to add.
4. ✅ **6 gradient backgrounds.** Done - see "Phase 5 item 4" under START
   HERE above. Pushed to `main` and deployed to the live site. `Background` gained a
   `{ type: 'gradient'; from; to }` variant plus 6 named presets; the picker
   became a popover (`BackgroundMenu.tsx`, the `ExportMenu` pattern) instead
   of growing the inline swatch row, so this doesn't make the standing
   mobile-overflow finding worse.
5. ✅ **Accessibility pass** (the 4 concrete gaps item 1/2's audits found).
   Done - see "Phase 5 item 5" under START HERE above. Lighthouse itself
   isn't installed in this environment, so the a11y > 95 target is still
   unmeasured by that specific tool - the 4 named gaps are closed and
   verified by other means (see the note).
6. ✅ **Friendly error messages everywhere.** Done - see "Phase 5 item 6"
   under START HERE above. Also fixed a real pre-existing bug this audit
   found: the rejection toasts were bypassing `en.ts` entirely via a
   hardcoded duplicate in `boardStore.ts`.
7. ✅ **Right-click context menu.** Done - see "Phase 5 items 7 and 8"
   under START HERE above. A second entry point to the same selection
   actions `SelectionToolbar` already exposes (Crop/Duplicate/Bring to
   front/Delete) - no new store actions, just a new UI surface over
   existing ones, exactly as planned.
8. ✅ **Help page / shortcut cheatsheet, opened with `?`.** Done - see
   "Phase 5 items 7 and 8" under START HERE above. A single static
   reference built by hand from every shortcut currently bound, plus two
   real bindings this guide's own list had missed (`Space` held to pan,
   and plain `Enter` to confirm a crop session) - the full set is now
   `+ - 0 1 Esc Del/Backspace D F A R T N C ?` plus `Ctrl/Cmd+Z`,
   `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Shift+C`, `Ctrl/Cmd+Enter`, and `Enter`
   (crop-session-only).
9. ✅ **Animation / micro-interactions.** Done - see "Phase 5 item 9" under
   START HERE above. Scoped to entrance animation for every popover/modal,
   toast enter+exit, and hover/press feedback on every control that was
   missing it - found and fixed a real pre-existing accessibility race in
   `useFocusTrap` along the way.
10. ❌ **Cancelled - i18n: Thai/English.** Explicit user decision
    (2026-09-14): English-only is sufficient, no Thai UI translation
    needed. Not to be raised again. (`src/i18n/en.ts` remains the single
    source of every user-facing string regardless - that structure was
    never specific to this cancelled item, it's just how copy is
    organized in this codebase.)
11. ✅ **Mobile lite mode.** Done - see "Phase 5 item 11" under START HERE
    above. Turned out narrower than this list's own line above once the
    product plan's §4.6 was actually re-read: no general mobile-shaped
    layout rework, just `BoardCanvas` rendering non-interactively (no
    drag/resize/annotate/crop/zoom/pan) below a ~700px viewport, with the
    existing (already item-3-fixed) `TopBar` as the entire "pick images ->
    pick a layout mode -> save" flow. Pushed to `main` and deployed to the
    live site (`84d0383`), on the user's approval.

**Phase 5 is done when:** 5 new users understand the app within 10 seconds
with no explanation (needs real people, same category as Phase 1's
Time-To-Copy measurement - not doable from inside this environment) ·
Lighthouse a11y score > 95 · the product plan's own Definition of Done
(section 12) is met.

## After Phase 5

Phase 6 persistence and PWA · Phase 7 Chrome extension. Neither has a
detailed item breakdown in this guide yet (unlike Phase 2–5) - write one the
same way this file's own history shows, once Phase 5 actually finishes. Full
definitions in [docs/00-product-plan.md](docs/00-product-plan.md) section 12.

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
Size, style, pixel ratio, and (since Phase 4 item 6) crop are the only things
that may invalidate a tile — crop changes what's drawn inside the tile just
as much as a style change does.

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
- **A popover's own CSS entrance animation can starve a focus-management raf
  that has nothing to do with animation.** Found adding the popover-in
  entrance animation (Phase 5 item 9): `useFocusTrap`'s mount-time
  `requestAnimationFrame` (which moves focus into a just-opened popover) has
  always unconditionally overridden whatever already had focus, with no
  check for "did something already focus a specific control in here." That
  was a rare, pre-existing race (~1 in 8 in a repeated instrumented test)
  even without any animation; adding a 130ms `animation` to the popover's own
  CSS pushed it to ~4 in 5 - the extra per-frame paint work apparently shifts
  when the raf actually fires relative to anything else racing it (a real
  keyboard user tabbing in, a test's own `.focus()` call). Fixed by guarding
  the raf with `container.contains(document.activeElement)` - it now only
  force-focuses the first child if focus is still genuinely outside the
  popover. Worth checking first if a future popover/modal animation seems to
  make an *unrelated* focus or keyboard-input test flaky - the animation
  itself is rarely the direct cause; it's more likely exposing a race that
  already existed.
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

Automation here runs headless on Linux, so two things remain unproven and
need a real machine:

1. Copy → paste into Slack, LINE, Jira, Gmail, Word, and (Phase 3 DoD, still
   open) inserting the downloaded PNG/JPG file into Figma and Google Docs too
   — as a results table, per [docs/phases/phase-3.md](docs/phases/phase-3.md).
2. Paste *from* Windows Snipping Tool and macOS Cmd+Shift+4.

Copy on real Safari and real Firefox was explicitly skipped by the user
(2026-09-13) and is no longer tracked as an open item.

Checklist to work through:
[docs/manual-test-checklist.md](docs/manual-test-checklist.md).
Human Time-To-Copy (<20s target) has also not been measured with real people.
