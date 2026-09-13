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
    const raf = requestAnimationFrame(() => {
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
