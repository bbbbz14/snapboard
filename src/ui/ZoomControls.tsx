import { t } from '@/i18n/t'

interface Props {
  percent: number
  onZoomOut: () => void
  onZoomIn: () => void
  onReset: () => void
  onFit: () => void
}

/**
 * Bottom-right, per the screen layout in docs/00-product-plan.md 4.2 —
 * deliberately not in the top bar, which already overflows on mobile
 * (see CLAUDE.md) and would only get worse with more controls in it.
 */
export function ZoomControls({ percent, onZoomOut, onZoomIn, onReset, onFit }: Props) {
  return (
    <div className="zoom-controls" aria-label={t('zoom.level', { percent })}>
      <button className="zoom-btn" onClick={onZoomOut} title={t('zoom.out')} aria-label={t('zoom.out')}>
        −
      </button>
      <button className="zoom-pct" onClick={onReset} title={t('zoom.reset')}>
        {percent}%
      </button>
      <button className="zoom-btn" onClick={onZoomIn} title={t('zoom.in')} aria-label={t('zoom.in')}>
        +
      </button>
      <button className="zoom-btn zoom-fit" onClick={onFit} title={t('zoom.fit')} aria-label={t('zoom.fit')}>
        ⤢
      </button>
    </div>
  )
}
