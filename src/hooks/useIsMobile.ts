import { useEffect, useState } from 'react'

/** Below this width, the app shows the "lite" mobile flow (pick images ->
 * pick a layout mode -> save) instead of the full desktop editor - see the
 * product plan's own §4.6: free move/resize/annotate on a small screen is
 * "UX ที่แย่เสมอ" (always bad UX), so lite mode never even wires up the
 * canvas gestures that would need. A width query, not a UA sniff or
 * `pointer: coarse` - it's the same signal `.topbar`'s own overflow
 * scrolling already keys off implicitly, and it's what a resized desktop
 * window or Playwright's viewport emulation can both drive deterministically. */
const MOBILE_MAX_WIDTH = 700

/** True while the viewport is narrow enough for the mobile lite flow. Tracks
 * live window resizes (including a real device's orientation change), not
 * just the width at mount. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => matchMobile())
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

function matchMobile(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
}
