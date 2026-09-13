import { useEffect, useRef, useState } from 'react'
import { ANNOTATION_SIZE_RANGE, type AnnotationTool, type SizableAnnotationTool, type Tool } from '@/board/model/annotationDefaults'
import type { ToolSettings } from '@/board/store/boardStore'
import { AnnotationSettingsPopover } from '@/ui/AnnotationSettingsPopover'
import { t } from '@/i18n/t'

interface Props {
  tool: Tool
  onToggleArrow: () => void
  onToggleBox: () => void
  onToggleText: () => void
  onToggleMarker: () => void
  onToggleRedact: () => void
  toolSettings: ToolSettings
  onColorChange: (tool: AnnotationTool, color: string) => void
  onSizeChange: (tool: SizableAnnotationTool, size: number) => void
}

/**
 * Bottom-left, mirroring `ZoomControls`' bottom-right placement - a floating
 * button outside the top bar, per the same standing mobile-overflow note
 * (see CLAUDE.md) that already kept zoom and selection actions out of it.
 * Arrow, box, text, the numbered marker, and redact for now; the rest of
 * Phase 4's annotation tools land here too as they ship.
 *
 * The trailing settings button opens `AnnotationSettingsPopover` for
 * whichever tool is currently armed - disabled while `tool === 'select'`
 * since there is no tool context to adjust yet, per this revision's own
 * "while a tool is armed" framing (see CLAUDE.md).
 */
export function AnnotationToolbar({
  tool,
  onToggleArrow,
  onToggleBox,
  onToggleText,
  onToggleMarker,
  onToggleRedact,
  toolSettings,
  onColorChange,
  onSizeChange,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  // Committing an annotation (or Escape) reverts `tool` to 'select' - the
  // popover has nothing left to control at that point, so it must close
  // with it rather than lingering open over a now-inert settings button.
  useEffect(() => {
    if (tool === 'select') setSettingsOpen(false)
  }, [tool])

  const armed = tool === 'select' ? null : tool

  return (
    <div className="annotation-toolbar">
      <button
        className={`annotation-toolbar__btn${tool === 'arrow' ? ' is-active' : ''}`}
        onClick={onToggleArrow}
        title={t('annotate.arrowTitle')}
        aria-label={t('annotate.arrow')}
        aria-pressed={tool === 'arrow'}
        style={tool === 'arrow' ? { background: toolSettings.arrow.color } : undefined}
      >
        ↗
      </button>
      <button
        className={`annotation-toolbar__btn${tool === 'box' ? ' is-active' : ''}`}
        onClick={onToggleBox}
        title={t('annotate.boxTitle')}
        aria-label={t('annotate.box')}
        aria-pressed={tool === 'box'}
        style={tool === 'box' ? { background: toolSettings.box.color } : undefined}
      >
        ▢
      </button>
      <button
        className={`annotation-toolbar__btn${tool === 'text' ? ' is-active' : ''}`}
        onClick={onToggleText}
        title={t('annotate.textTitle')}
        aria-label={t('annotate.text')}
        aria-pressed={tool === 'text'}
        style={tool === 'text' ? { background: toolSettings.text.color } : undefined}
      >
        T
      </button>
      <button
        className={`annotation-toolbar__btn${tool === 'marker' ? ' is-active' : ''}`}
        onClick={onToggleMarker}
        title={t('annotate.markerTitle')}
        aria-label={t('annotate.marker')}
        aria-pressed={tool === 'marker'}
        style={tool === 'marker' ? { background: toolSettings.marker.color } : undefined}
      >
        ①
      </button>
      <button
        className={`annotation-toolbar__btn${tool === 'redact' ? ' is-active' : ''}`}
        onClick={onToggleRedact}
        title={t('annotate.redactTitle')}
        aria-label={t('annotate.redact')}
        aria-pressed={tool === 'redact'}
        style={tool === 'redact' ? { background: toolSettings.redact.color } : undefined}
      >
        ■
      </button>
      <span className="annotation-toolbar__divider" aria-hidden="true" />
      <button
        ref={settingsBtnRef}
        className="annotation-toolbar__btn"
        onClick={() => setSettingsOpen((v) => !v)}
        disabled={armed === null}
        title={t('annotate.settingsTitle')}
        aria-label={t('annotate.settings')}
        aria-expanded={settingsOpen}
      >
        <span className="annotation-toolbar__swatch" style={armed ? { background: toolSettings[armed].color } : undefined} />
      </button>
      {settingsOpen && armed && (
        <AnnotationSettingsPopover
          color={toolSettings[armed].color}
          onColorChange={(c) => onColorChange(armed, c)}
          size={armed === 'redact' ? null : toolSettings[armed].size}
          sizeRange={armed === 'redact' ? null : ANNOTATION_SIZE_RANGE[armed]}
          onSizeChange={(s) => {
            if (armed !== 'redact') onSizeChange(armed, s)
          }}
          onClose={() => setSettingsOpen(false)}
          anchorRef={settingsBtnRef}
        />
      )}
    </div>
  )
}
