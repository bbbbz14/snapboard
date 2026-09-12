import { t } from '@/i18n/t'

interface Props {
  tool: 'select' | 'arrow'
  onToggleArrow: () => void
}

/**
 * Bottom-left, mirroring `ZoomControls`' bottom-right placement - a floating
 * button outside the top bar, per the same standing mobile-overflow note
 * (see CLAUDE.md) that already kept zoom and selection actions out of it.
 * One button for now (Arrow); the rest of Phase 4's annotation tools land
 * here too as they ship.
 */
export function AnnotationToolbar({ tool, onToggleArrow }: Props) {
  return (
    <div className="annotation-toolbar">
      <button
        className={`annotation-toolbar__btn${tool === 'arrow' ? ' is-active' : ''}`}
        onClick={onToggleArrow}
        title={t('annotate.arrowTitle')}
        aria-label={t('annotate.arrow')}
        aria-pressed={tool === 'arrow'}
      >
        ↗
      </button>
    </div>
  )
}
