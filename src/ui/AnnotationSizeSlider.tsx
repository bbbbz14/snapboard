import { useId } from 'react'
import { t } from '@/i18n/t'

interface Props {
  size: number
  sizeRange: { min: number; max: number }
  onChange: (size: number) => void
  /** Opens/closes a `boardStore.beginAdjustment`/`endAdjustment` window
   * around the whole slider drag - see `SelectionToolbar`'s own note on why
   * only the edit-in-place path (which mutates already-placed `Board` state)
   * needs this and the armed-tool path doesn't. */
  onAdjustStart?: (() => void) | undefined
  onAdjustEnd?: (() => void) | undefined
}

/**
 * Always visible next to the color button whenever the currently armed tool
 * (or selected annotation node) has a size dimension - no popover click
 * needed to reach it. Previously this lived inside the color/settings
 * popover, and real-usage feedback on the live site found that most users
 * never discovered it existed at all, since nothing about the color button
 * hinted a size control was behind it too ("ต้องกดปุ่มเลือกสีก่อนถึงจะเจอแถบ
 * Size") - pulling it out into its own always-visible control is the fix.
 *
 * Used for arrow/line/box (stroke width) and marker (diameter) - all four
 * are a continuous, smoothly-draggable function of `size`. Text uses
 * `AnnotationSizeStepper` instead, not this component - see that
 * component's own note on why a drag gesture doesn't work for it.
 */
export function AnnotationSizeSlider({ size, sizeRange, onChange, onAdjustStart, onAdjustEnd }: Props) {
  const id = useId()
  return (
    <label className="slider" htmlFor={id}>
      {t('annotate.size')}
      <input
        id={id}
        type="range"
        min={sizeRange.min}
        max={sizeRange.max}
        step={1}
        value={size}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={onAdjustStart}
        onPointerUp={onAdjustEnd}
        onKeyDown={onAdjustStart}
        onKeyUp={onAdjustEnd}
        aria-label={t('annotate.size')}
      />
      <span className="annotation-settings__value">{size}px</span>
    </label>
  )
}
