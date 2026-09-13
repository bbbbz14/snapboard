import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ANNOTATION_COLORS } from '@/board/model/annotationDefaults'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { t } from '@/i18n/t'

interface Props {
  color: string
  onColorChange: (color: string) => void
  /** `null` for redact - it has no size dimension (see `RedactNode`'s own
   * note), so the slider row doesn't render at all rather than being shown
   * disabled. */
  size: number | null
  sizeRange: { min: number; max: number } | null
  onSizeChange: (size: number) => void
  /** Opens/closes a `boardStore.beginAdjustment`/`endAdjustment` window
   * around the whole slider drag, same as `TopBar`'s gap slider - only
   * passed by `SelectionToolbar`, whose `onSizeChange` mutates an
   * already-placed node's `Board` state (`setNodeSize`/`commitText`) and so,
   * without this, would push one full undo-history entry (and one full
   * board re-commit) per 'input' event of the drag, the exact "50+ entries
   * for one gesture" problem Phase 2 item 7 already fixed once for the gap
   * slider - just never applied here when this edit-in-place feature was
   * added later. `AnnotationToolbar`'s own use of this popover only ever
   * changes `toolSettings` (not `Board`), which was never routed through
   * undo history in the first place, so it has nothing to batch and leaves
   * these undefined. */
  onAdjustStart?: (() => void) | undefined
  onAdjustEnd?: (() => void) | undefined
  onClose: () => void
  /** The toolbar's settings button - measured once on mount to position
   * this (fixed-position, see styles.css) popover above it, mirroring
   * `ExportMenu`'s own anchor pattern but anchored upward since the
   * annotation toolbar lives at the bottom of the viewport. */
  anchorRef: RefObject<HTMLButtonElement | null>
}

/**
 * Color (and, except for redact, size) controls for whichever annotation
 * tool is currently armed - opened from `AnnotationToolbar`'s settings
 * button, same popover pattern `ExportMenu` already established for
 * Download's scale/format/quality controls. Scrolling the mouse wheel while
 * a tool is armed adjusts the same underlying store value (see
 * BoardCanvas's wheel handler) - this popover is the explicit, discoverable
 * way to do the same thing, not a separate setting.
 */
export function AnnotationSettingsPopover({
  color,
  onColorChange,
  size,
  sizeRange,
  onSizeChange,
  onAdjustStart,
  onAdjustEnd,
  onClose,
  anchorRef,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const sizeId = useId()
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null)

  useFocusTrap(ref, anchorRef)

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left })
  }, [anchorRef])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && e.target !== anchorRef.current) onClose()
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

      {size != null && sizeRange && (
        <label className="slider" htmlFor={sizeId}>
          {t('annotate.size')}
          <input
            id={sizeId}
            type="range"
            min={sizeRange.min}
            max={sizeRange.max}
            step={1}
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            onPointerDown={onAdjustStart}
            onPointerUp={onAdjustEnd}
            onKeyDown={onAdjustStart}
            onKeyUp={onAdjustEnd}
            aria-label={t('annotate.size')}
          />
          <span className="annotation-settings__value">{size}px</span>
        </label>
      )}
    </div>,
    document.body,
  )
}
