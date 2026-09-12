import { t } from '@/i18n/t'

interface Props {
  tool: 'select' | 'arrow' | 'box' | 'text' | 'marker' | 'redact'
  onToggleArrow: () => void
  onToggleBox: () => void
  onToggleText: () => void
  onToggleMarker: () => void
  onToggleRedact: () => void
}

/**
 * Bottom-left, mirroring `ZoomControls`' bottom-right placement - a floating
 * button outside the top bar, per the same standing mobile-overflow note
 * (see CLAUDE.md) that already kept zoom and selection actions out of it.
 * Arrow, box, text, the numbered marker, and redact for now; the rest of
 * Phase 4's annotation tools land here too as they ship.
 */
export function AnnotationToolbar({ tool, onToggleArrow, onToggleBox, onToggleText, onToggleMarker, onToggleRedact }: Props) {
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
      <button
        className={`annotation-toolbar__btn${tool === 'marker' ? ' is-active' : ''}`}
        onClick={onToggleMarker}
        title={t('annotate.markerTitle')}
        aria-label={t('annotate.marker')}
        aria-pressed={tool === 'marker'}
      >
        ①
      </button>
      <button
        className={`annotation-toolbar__btn${tool === 'redact' ? ' is-active' : ''}`}
        onClick={onToggleRedact}
        title={t('annotate.redactTitle')}
        aria-label={t('annotate.redact')}
        aria-pressed={tool === 'redact'}
      >
        ■
      </button>
    </div>
  )
}
