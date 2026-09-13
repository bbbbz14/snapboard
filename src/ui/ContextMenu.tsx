import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from '@/i18n/t'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props {
  x: number
  y: number
  /** Only passed when the selection is exactly one image node - same gating
   * `SelectionToolbar`'s own Crop button uses. */
  onCrop?: (() => void) | undefined
  onDuplicate: () => void
  onBringToFront: () => void
  onDelete: () => void
  onClose: () => void
}

/**
 * Right-click entry point to the exact same selection actions
 * `SelectionToolbar` already exposes - not a new set of actions, just a
 * second way to reach them (Phase 5 item 7). Anchored at the click point
 * rather than a button, so `useFocusTrap`'s `anchorRef` has nothing to
 * point at; it already falls back to whatever had focus before the menu
 * opened (see that hook's own note).
 */
export function ContextMenu({ x, y, onCrop, onDuplicate, onBringToFront, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useFocusTrap(ref, anchorRef)

  // Same "measure once rendered, then reposition" trick as ExportMenu, but
  // clamped against the viewport instead of anchored under a button - a
  // right-click near the edge of the screen must not draw the menu off it.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.min(x, window.innerWidth - rect.width - 8)
    const top = Math.min(y, window.innerHeight - rect.height - 8)
    setPos({ left: Math.max(8, left), top: Math.max(8, top) })
  }, [x, y])

  useEffect(() => {
    // Deliberately not also listening for `contextmenu` here: the click that
    // *opens* this menu is itself a `contextmenu` event still bubbling
    // toward `document` at the moment this effect runs (it fires from
    // BoardCanvas's `onContextMenu`, which is what mounted this component in
    // the first place) - a same-type listener added here would catch that
    // same in-flight event and close the menu the instant it opens. A right
    // click elsewhere already closes/repositions correctly without this: any
    // mouse button's `mousedown` (including the right button) fires before
    // its own `contextmenu` does, so the listener below already covers it.
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const act = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t('contextMenu.label')}
      tabIndex={-1}
      className="context-menu"
      style={pos ? { top: pos.top, left: pos.left } : { top: y, left: x, visibility: 'hidden' }}
    >
      {onCrop && (
        <button role="menuitem" className="context-menu__item" onClick={act(onCrop)}>
          <span className="context-menu__icon" aria-hidden="true">
            ⛶
          </span>
          {t('selection.crop')}
        </button>
      )}
      <button role="menuitem" className="context-menu__item" onClick={act(onDuplicate)}>
        <span className="context-menu__icon" aria-hidden="true">
          ⧉
        </span>
        {t('selection.duplicateTitle')}
      </button>
      <button role="menuitem" className="context-menu__item" onClick={act(onBringToFront)}>
        <span className="context-menu__icon" aria-hidden="true">
          ⤒
        </span>
        {t('selection.bringToFrontTitle')}
      </button>
      <button role="menuitem" className="context-menu__item context-menu__item--danger" onClick={act(onDelete)}>
        <span className="context-menu__icon" aria-hidden="true">
          🗑
        </span>
        {t('selection.delete')}
      </button>
    </div>
  )
}
