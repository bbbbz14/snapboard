import { forwardRef } from 'react'
import { t } from '@/i18n/t'

interface Props {
  onDuplicate: () => void
  onBringToFront: () => void
  onDelete: () => void
}

/**
 * Small floating toolbar above the current selection, per the product plan's
 * "progressive disclosure" principle (4.1) and its 4.2 mockup - tools appear
 * on the object, not in the top bar, which already overflows on mobile (see
 * CLAUDE.md). Position is imperative (BoardCanvas writes to this element's
 * style directly in `drawInteraction`), not React state, to stay on the
 * ref-first 60fps pattern the camera/drag code already uses - see the style
 * prop starting hidden below.
 */
export const SelectionToolbar = forwardRef<HTMLDivElement, Props>(function SelectionToolbar(
  { onDuplicate, onBringToFront, onDelete },
  ref,
) {
  return (
    <div ref={ref} className="selection-toolbar" style={{ display: 'none' }}>
      <button className="selection-toolbar__btn" title={t('selection.duplicateTitle')} aria-label={t('selection.duplicate')} onClick={onDuplicate}>
        ⧉
      </button>
      <button className="selection-toolbar__btn" title={t('selection.bringToFrontTitle')} aria-label={t('selection.bringToFront')} onClick={onBringToFront}>
        ⤒
      </button>
      <button className="selection-toolbar__btn selection-toolbar__btn--danger" title={t('selection.delete')} aria-label={t('selection.delete')} onClick={onDelete}>
        🗑
      </button>
    </div>
  )
})
