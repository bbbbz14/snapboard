import { useEffect, useRef, useState } from 'react'
import { ANNOTATION_SIZE_RANGE, type AnnotationTool, type SizableAnnotationTool, type Tool } from '@/board/model/annotationDefaults'
import type { ToolSettings } from '@/board/store/boardStore'
import { AnnotationColorPopover } from '@/ui/AnnotationColorPopover'
import { AnnotationSizeSlider } from '@/ui/AnnotationSizeSlider'
import { modKey, t } from '@/i18n/t'

interface Props {
  tool: Tool
  onToggleArrow: () => void
  onToggleLine: () => void
  onToggleBox: () => void
  onToggleText: () => void
  onToggleMarker: () => void
  onToggleRedact: () => void
  toolSettings: ToolSettings
  onColorChange: (tool: AnnotationTool, color: string) => void
  onSizeChange: (tool: SizableAnnotationTool, size: number) => void
  /** Only meaningful for the arrow tool - see `ToolSettings.arrow`'s own
   * note on straight-vs-curved. */
  onStraightChange: (straight: boolean) => void
  /** Undo/redo, right next to the drawing tools rather than only reachable
   * via Ctrl/Cmd+Z - real-usage feedback: a user who draws something "wrong"
   * wants a one-click way back, Lightshot-style, and many users never
   * discover the keyboard shortcut at all. */
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

/**
 * Bottom-left, mirroring `ZoomControls`' bottom-right placement - a floating
 * button outside the top bar, per the same standing mobile-overflow note
 * (see CLAUDE.md) that already kept zoom and selection actions out of it.
 * Arrow, line, box, text, the numbered marker, and redact for now; the rest
 * of Phase 4's annotation tools land here too as they ship.
 *
 * The trailing color button opens `AnnotationColorPopover` for whichever
 * tool is currently armed, disabled otherwise - see `settingsTool`'s own
 * note below for why this no longer remembers the last-armed tool the way
 * an earlier version did.
 */
export function AnnotationToolbar({
  tool,
  onToggleArrow,
  onToggleLine,
  onToggleBox,
  onToggleText,
  onToggleMarker,
  onToggleRedact,
  toolSettings,
  onColorChange,
  onSizeChange,
  onStraightChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const [colorOpen, setColorOpen] = useState(false)
  const colorBtnRef = useRef<HTMLButtonElement>(null)

  // The tool the color button/popover/size slider reflect: only the
  // currently armed one, not whatever was last armed. A one-shot tool
  // reverts `tool` to 'select' and auto-selects the shape it just drew (see
  // each `add*` action), so `SelectionToolbar`'s own "Edit style" popover
  // takes over checking/adjusting that exact node from here - showing both
  // at once would mean two identically-labeled "Size" controls on screen
  // simultaneously, editing two different things (this tool's default for
  // the *next* shape vs. the node just drawn). An earlier version of this
  // component (before `SelectionToolbar` gained its own style controls)
  // remembered the last-armed tool specifically to keep this reachable right
  // after drawing - that reason no longer applies now that the freshly
  // selected node's own controls cover it instead.
  const settingsTool: AnnotationTool | null = tool === 'select' ? null : tool

  // Drawing a shape via the canvas already closes this popover naturally -
  // starting the drag/click is itself a `mousedown` outside the popover,
  // which `AnnotationColorPopover`'s own outside-click listener catches
  // before the shape ever commits. Cancelling the armed tool via Escape,
  // though, reverts `tool` to 'select' with no mousedown at all, so without
  // this the popover's own `colorOpen` state would stay stuck `true` and
  // silently reopen, unprompted, the next time the same tool is re-armed.
  useEffect(() => {
    if (settingsTool === null) setColorOpen(false)
  }, [settingsTool])

  return (
    <div className="annotation-toolbar">
      <button
        className="annotation-toolbar__btn"
        onClick={onUndo}
        disabled={!canUndo}
        title={t('annotate.undoTitle', { mod: modKey() })}
        aria-label={t('annotate.undo')}
      >
        ↶
      </button>
      <button
        className="annotation-toolbar__btn"
        onClick={onRedo}
        disabled={!canRedo}
        title={t('annotate.redoTitle', { mod: modKey() })}
        aria-label={t('annotate.redo')}
      >
        ↷
      </button>
      <span className="annotation-toolbar__divider" aria-hidden="true" />
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
        className={`annotation-toolbar__btn${tool === 'line' ? ' is-active' : ''}`}
        onClick={onToggleLine}
        title={t('annotate.lineTitle')}
        aria-label={t('annotate.line')}
        aria-pressed={tool === 'line'}
        style={tool === 'line' ? { background: toolSettings.line.color } : undefined}
      >
        ─
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
        ref={colorBtnRef}
        className="annotation-toolbar__btn"
        onClick={() => setColorOpen((v) => !v)}
        disabled={settingsTool === null}
        title={t('annotate.settingsTitle')}
        aria-label={t('annotate.settings')}
        aria-expanded={colorOpen}
      >
        <span className="annotation-toolbar__swatch" style={settingsTool ? { background: toolSettings[settingsTool].color } : undefined} />
      </button>
      {settingsTool && settingsTool !== 'redact' && (
        <AnnotationSizeSlider
          size={toolSettings[settingsTool].size}
          sizeRange={ANNOTATION_SIZE_RANGE[settingsTool]}
          onChange={(s) => onSizeChange(settingsTool, s)}
        />
      )}
      {colorOpen && settingsTool && (
        <AnnotationColorPopover
          color={toolSettings[settingsTool].color}
          onColorChange={(c) => onColorChange(settingsTool, c)}
          straight={settingsTool === 'arrow' ? toolSettings.arrow.straight : null}
          onStraightChange={settingsTool === 'arrow' ? onStraightChange : undefined}
          onClose={() => setColorOpen(false)}
          anchorRef={colorBtnRef}
        />
      )}
    </div>
  )
}
