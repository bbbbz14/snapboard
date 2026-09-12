import { t } from '@/i18n/t'

interface Props {
  tool: 'select' | 'arrow' | 'box' | 'text'
  onToggleArrow: () => void
  onToggleBox: () => void
  onToggleText: () => void
}

/**
 * Bottom-left, mirroring `ZoomControls`' bottom-right placement - a floating
 * button outside the top bar, per the same standing mobile-overflow note
 * (see CLAUDE.md) that already kept zoom and selection actions out of it.
 * Arrow, box, and text for now; the rest of Phase 4's annotation tools land
 * here too as they ship.
 */
export function AnnotationToolbar({ tool, onToggleArrow, onToggleBox, onToggleText }: Props) {
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
      <button
        className={`annotation-toolbar__btn${tool === 'text' ? ' is-active' : ''}`}
        onClick={onToggleText}
        title={t('annotate.textTitle')}
        aria-label={t('annotate.text')}
        aria-pressed={tool === 'text'}
      >
        T
      </button>
    </div>
  )
}
