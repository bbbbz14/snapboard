import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ANNOTATION_COLORS } from '@/board/model/annotationDefaults'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { t } from '@/i18n/t'

interface Props {
  color: string
  onColorChange: (color: string) => void
  /** Non-null only for the arrow tool/node - every other annotation kind has
   * no line-style dimension to toggle. `true` = straight (the tool's own
   * default, see `boardStore`'s `DEFAULT_TOOL_SETTINGS`), `false` = the
   * original gently curved connector. */
  straight: boolean | null
  onStraightChange?: ((straight: boolean) => void) | undefined
  onClose: () => void
  /** The toolbar's color button - measured once on mount to position this
   * (fixed-position, see styles.css) popover above it, mirroring
   * `ExportMenu`'s own anchor pattern but anchored upward since the
   * annotation toolbar lives at the bottom of the viewport. */
  anchorRef: RefObject<HTMLButtonElement | null>
}

/**
 * Color (and, for arrow only, straight-vs-curved line style) controls for
 * whichever annotation tool is currently armed or node is selected - opened
 * from a small color-swatch button, same popover pattern `ExportMenu`
 * already established for Download's scale/format/quality controls. Size no
 * longer lives here - see `AnnotationSizeSlider`, shown inline in the
 * toolbar itself instead: real-usage feedback found that gating the size
 * control behind this popover's own button meant most users never
 * discovered it existed at all ("ต้องกดปุ่มเลือกสีก่อนถึงจะเจอแถบ Size").
 */
export function AnnotationColorPopover({ color, onColorChange, straight, onStraightChange, onClose, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null)

  useFocusTrap(ref, anchorRef)

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left })
  }, [anchorRef])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      // `contains`, not `!==` - the anchor button has its own child (the
      // swatch `<span>`), and a click there reports `e.target` as that span,
      // not the button. An exact-identity check misclassified that as an
      // outside click, which closed the popover via this listener and then,
      // in the same gesture, the button's own onClick fired against the
      // now-stale `colorOpen` closure and reopened it - net effect: clicking
      // the anchor button a second time to close the popover silently did
      // nothing (found via a throwaway repro script when this button's
      // position shifted enough for Playwright's click point to land
      // squarely on the span instead of the button's own padding).
      if (ref.current && !ref.current.contains(target) && !anchorRef.current?.contains(target)) onClose()
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
  }, [onClose, anchorRef])

  // Rendered through a portal, not as a plain child of the anchor's own
  // toolbar - `SelectionToolbar` (one of the two toolbars this popover can be
  // opened from) is positioned with a CSS `transform` (see styles.css), and a
  // `transform` on an ancestor creates a new containing block for any
  // `position: fixed` descendant. Left as a normal child, this popover's
  // `bottom`/`left` (computed above from `window.innerHeight`/
  // `getBoundingClientRect()`, which assume a viewport-relative fixed
  // position) would resolve against the transformed toolbar's own small box
  // instead - landing far from the button that opened it. `AnnotationToolbar`
  // has no `transform` on its container, which is why this only ever showed
  // up on the "edit an already-placed annotation" path. A portal to
  // `document.body` sidesteps the containing-block chain entirely, so this
  // stays correct regardless of what transform/filter an anchor's ancestor
  // has now or gains later.
  return createPortal(
    <div
      ref={ref}
      className="annotation-settings"
      role="dialog"
      aria-label={t('annotate.settings')}
      tabIndex={-1}
      style={pos ? { bottom: pos.bottom, left: pos.left } : { visibility: 'hidden' }}
    >
      <div className="annotation-settings__row">
        <span className="annotation-settings__label">{t('annotate.color')}</span>
        <div className="annotation-settings__swatches" role="group" aria-label={t('annotate.color')}>
          {ANNOTATION_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="annotation-settings__swatch"
              style={{ background: c }}
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => onColorChange(c)}
            />
          ))}
        </div>
      </div>

      {straight != null && onStraightChange && (
        <div className="annotation-settings__row">
          <span className="annotation-settings__label">{t('annotate.lineStyle')}</span>
          <div className="group" role="group" aria-label={t('annotate.lineStyle')}>
            <button type="button" className="chip" aria-pressed={straight} onClick={() => onStraightChange(true)}>
              {t('annotate.straight')}
            </button>
            <button type="button" className="chip" aria-pressed={!straight} onClick={() => onStraightChange(false)}>
              {t('annotate.curved')}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
