import { forwardRef } from 'react'
import { t } from '@/i18n/t'

interface Props {
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Floating confirm/cancel toolbar shown above the crop window while a crop
 * session (opened from the SelectionToolbar's Crop button) is in progress.
 * Reuses SelectionToolbar's own `.selection-toolbar`/`__btn` classes for the
 * identical floating-pill look, but is a separate component: its actions and
 * lifecycle (a modal-like edit of one node) are unrelated to the normal
 * selection toolbar's, and the two are never shown at the same time (see
 * BoardCanvas's `drawInteraction`).
 */
export const CropToolbar = forwardRef<HTMLDivElement, Props>(function CropToolbar({ onConfirm, onCancel }, ref) {
  return (
    <div ref={ref} className="selection-toolbar" style={{ display: 'none' }}>
      <button className="selection-toolbar__btn" title={t('crop.confirm')} aria-label={t('crop.confirm')} onClick={onConfirm}>
        ✓
      </button>
      <button className="selection-toolbar__btn selection-toolbar__btn--danger" title={t('crop.cancel')} aria-label={t('crop.cancel')} onClick={onCancel}>
        ✕
      </button>
    </div>
  )
})
