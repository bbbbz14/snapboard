import { t } from '@/i18n/t'

interface Props {
  tool: 'select' | 'arrow' | 'box'
  onToggleArrow: () => void
  onToggleBox: () => void
}

/**
 * Bottom-left, mirroring `ZoomControls`' bottom-right placement - a floating
 * button outside the top bar, per the same standing mobile-overflow note
 * (see CLAUDE.md) that already kept zoom and selection actions out of it.
 * Arrow and box for now; the rest of Phase 4's annotation tools land here
 * too as they ship.
 */
export function AnnotationToolbar({ tool, onToggleArrow, onToggleBox }: Props) {
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
      <button
        className={`annotation-toolbar__btn${tool === 'box' ? ' is-active' : ''}`}
        onClick={onToggleBox}
        title={t('annotate.boxTitle')}
        aria-label={t('annotate.box')}
        aria-pressed={tool === 'box'}
      >
        ▢
      </button>
    </div>
  )
}
