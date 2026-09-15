import { t } from '@/i18n/t'

interface Props {
  size: number
  sizeRange: { min: number; max: number }
  onChange: (size: number) => void
}

/**
 * A discrete -/+ control, not a draggable slider - used only for the text
 * tool's font size (see `AnnotationSizeSlider`'s own note on why every
 * other sizable tool keeps the slider). Unlike stroke width or marker
 * diameter, a text node's box height is not a continuous function of
 * `size`: `wrapText`'s line count changes in whole-line jumps at certain
 * font sizes rather than growing smoothly, so dragging a slider through one
 * of those thresholds made the box visibly bounce between the two line
 * counts as the pointer's own sub-pixel jitter crossed back and forth over
 * it - confirmed live, not guessed (see CLAUDE.md's Phase 5 annotation
 * notes for the investigation). A click is never mid-gesture, so there is
 * nothing for it to jitter between: each click is one deliberate, complete
 * size change, and the box settles at its correctly-fitted size immediately
 * every time - trading "drag across the whole range in one gesture" for
 * "always see the real result, one step at a time", which is the whole
 * point given the box can't be smoothly interpolated between line counts
 * anyway.
 */
export function AnnotationSizeStepper({ size, sizeRange, onChange }: Props) {
  return (
    <div className="size-stepper" role="group" aria-label={t('annotate.size')}>
      <button
        type="button"
        className="size-stepper__btn"
        onClick={() => onChange(Math.max(sizeRange.min, size - 1))}
        disabled={size <= sizeRange.min}
        title={t('annotate.sizeDecrease')}
        aria-label={t('annotate.sizeDecrease')}
      >
        −
      </button>
      <span className="annotation-settings__value">{size}px</span>
      <button
        type="button"
        className="size-stepper__btn"
        onClick={() => onChange(Math.min(sizeRange.max, size + 1))}
        disabled={size >= sizeRange.max}
        title={t('annotate.sizeIncrease')}
        aria-label={t('annotate.sizeIncrease')}
      >
        +
      </button>
    </div>
  )
}
