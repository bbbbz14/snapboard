import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ANNOTATION_COLORS } from '@/board/model/annotationDefaults'
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
export function AnnotationSettingsPopover({ color, onColorChange, size, sizeRange, onSizeChange, onClose, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null)

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

  return (
    <div
      ref={ref}
      className="annotation-settings"
      role="dialog"
      aria-label={t('annotate.settings')}
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
        <label className="slider">
          {t('annotate.size')}
          <input
            type="range"
            min={sizeRange.min}
            max={sizeRange.max}
            step={1}
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            aria-label={t('annotate.size')}
          />
          <span className="annotation-settings__value">{size}px</span>
        </label>
      )}
    </div>
  )
}
