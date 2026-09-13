import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The three `role="dialog"` popovers (ExportMenu, BackgroundMenu,
 * AnnotationSettingsPopover) all copied only the anchored-position +
 * outside-click-closes half of the popover pattern - none of them moved
 * focus in on open, trapped Tab within the popover, or restored focus to the
 * button that opened them on close (Phase 5 item 5's accessibility audit).
 * Since each of these components only renders while open, mount = open and
 * unmount = close, so a plain mount/unmount effect covers every close path
 * (Escape, outside click, picking an option, the anchor button re-toggling)
 * for free - no `open` prop needed.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, anchorRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const previouslyFocused = anchorRef.current ?? (document.activeElement as HTMLElement | null)

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    // A raf, not a synchronous call: the container can still be positioned
    // via `visibility: hidden` (see ExportMenu/BackgroundMenu/
    // AnnotationSettingsPopover, all measure their anchor in a
    // `useLayoutEffect` and render hidden until that lands) when this effect
    // first runs, and a hidden element can't take focus - the call would
    // silently no-op. It also loses a race against the click that opened the
    // popover: a real click's own default action can (browser-dependent)
    // focus the anchor button itself after this effect's synchronous work
    // already ran. A raf runs after both have settled.
    //
    // The `container.contains(...)` guard is real, not defensive filler:
    // found this session (Phase 5 item 9) when adding a popover-open CSS
    // animation made a pre-existing race far more visible. Anything that
    // focuses a specific control inside the popover soon after it opens (a
    // real keyboard user tabbing in, or a caller's own programmatic focus)
    // could previously lose to this raf firing a moment later and yanking
    // focus back to the first focusable child unconditionally. Only force
    // focus in if nothing inside the container has it yet - that still
    // covers the two cases this raf exists for (a hidden element silently
    // ignoring an earlier .focus() call; the anchor button's own default
    // focus sitting outside the container) without ever overriding a focus
    // that already correctly landed inside.
    const raf = requestAnimationFrame(() => {
      if (container.contains(document.activeElement)) return
      const first = focusables()[0]
      ;(first ?? container).focus()
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const firstEl = items[0]!
      const lastEl = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    container.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      container.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus()
    }
  }, [ref, anchorRef])
}
