import { useRef, useState, forwardRef } from 'react'
import { t } from '@/i18n/t'
import { AnnotationSettingsPopover } from '@/ui/AnnotationSettingsPopover'

export interface StyleTarget {
  color: string
  /** `null` for redact - it has no size dimension, same as the popover's
   * own note on why the slider row doesn't render for it. */
  size: number | null
  sizeRange: { min: number; max: number } | null
}

interface Props {
  /** Only passed when the selection is exactly one image node - Crop makes
   * no sense for a multi-selection or for an annotation kind (arrow/box/
   * text/marker/redact), so the button itself only renders when there's
   * somewhere for it to go. */
  onCrop?: (() => void) | undefined
  onDuplicate: () => void
  onBringToFront: () => void
  onDelete: () => void
  /** Only passed when the selection is exactly one annotation node (not an
   * image, not a multi-selection) - lets that node's own color/size be
   * edited in place, the same popover `AnnotationToolbar` opens for
   * whichever tool is armed, just targeting the selected node instead of
   * the tool's own default for the next one drawn. */
  style?: StyleTarget | undefined
  onStyleColorChange?: ((color: string) => void) | undefined
  onStyleSizeChange?: ((size: number) => void) | undefined
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
  { onCrop, onDuplicate, onBringToFront, onDelete, style, onStyleColorChange, onStyleSizeChange },
  ref,
) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <div ref={ref} className="selection-toolbar" style={{ display: 'none' }}>
      {onCrop && (
        <button className="selection-toolbar__btn" title={t('selection.crop')} aria-label={t('selection.crop')} onClick={onCrop}>
          ⛶
        </button>
      )}
      <button className="selection-toolbar__btn" title={t('selection.duplicateTitle')} aria-label={t('selection.duplicate')} onClick={onDuplicate}>
        ⧉
      </button>
      <button className="selection-toolbar__btn" title={t('selection.bringToFrontTitle')} aria-label={t('selection.bringToFront')} onClick={onBringToFront}>
        ⤒
      </button>
      {style && (
        <button
          ref={settingsBtnRef}
          className="selection-toolbar__btn"
          onClick={() => setSettingsOpen((v) => !v)}
          title={t('selection.styleTitle')}
          aria-label={t('selection.style')}
          aria-expanded={settingsOpen}
        >
          <span className="annotation-toolbar__swatch" style={{ background: style.color }} />
        </button>
      )}
      <button className="selection-toolbar__btn selection-toolbar__btn--danger" title={t('selection.delete')} aria-label={t('selection.delete')} onClick={onDelete}>
        🗑
      </button>
      {settingsOpen && style && onStyleColorChange && onStyleSizeChange && (
        <AnnotationSettingsPopover
          color={style.color}
          onColorChange={onStyleColorChange}
          size={style.size}
          sizeRange={style.sizeRange}
          onSizeChange={onStyleSizeChange}
          onClose={() => setSettingsOpen(false)}
          anchorRef={settingsBtnRef}
        />
      )}
    </div>
  )
})
