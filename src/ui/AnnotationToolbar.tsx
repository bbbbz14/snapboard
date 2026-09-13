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
 * whichever tool is currently armed, or was most recently armed
 * (`lastArmedTool`). Every annotation tool is one-shot - it commits and
 * reverts `tool` to 'select' the instant the user draws one shape (see each
 * tool's own note). The first version of this settings button disabled
 * itself the moment that happened, which broke the single most common real
 * flow: arm a tool, draw with it (the natural first thing to try), then try
 * to check or change its color/size - found by a user actually using the
 * live site, who reported "the button shows up but pressing it does
 * nothing" (it was disabled). Tracking the last-armed tool keeps settings
 * reachable across that revert without changing the one-shot draw behavior
 * itself.
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
  const [lastArmedTool, setLastArmedTool] = useState<AnnotationTool | null>(null)

  useEffect(() => {
    if (tool !== 'select') setLastArmedTool(tool)
  }, [tool])

  const armed = tool === 'select' ? null : tool
  // The tool the settings button/popover actually reflects: the currently
  // armed one, or - once nothing is armed because it just committed - the
  // last one that was, so the button stays usable across that revert.
  const settingsTool = armed ?? lastArmedTool

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
        disabled={settingsTool === null}
        title={t('annotate.settingsTitle')}
        aria-label={t('annotate.settings')}
        aria-expanded={settingsOpen}
      >
        <span className="annotation-toolbar__swatch" style={settingsTool ? { background: toolSettings[settingsTool].color } : undefined} />
      </button>
      {settingsOpen && settingsTool && (
        <AnnotationSettingsPopover
          color={toolSettings[settingsTool].color}
          onColorChange={(c) => onColorChange(settingsTool, c)}
          size={settingsTool === 'redact' ? null : toolSettings[settingsTool].size}
          sizeRange={settingsTool === 'redact' ? null : ANNOTATION_SIZE_RANGE[settingsTool]}
          onSizeChange={(s) => {
            if (settingsTool !== 'redact') onSizeChange(settingsTool, s)
          }}
          onClose={() => setSettingsOpen(false)}
          anchorRef={settingsBtnRef}
        />
      )}
    </div>
  )
}
