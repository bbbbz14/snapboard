import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Size } from '@/lib/geometry'
import type { ExportFormat, ExportOptions } from '@/board/export/exportBoard'
import { t } from '@/i18n/t'

const SCALES: (1 | 2 | 3)[] = [1, 2, 3]

interface Props {
  opts: ExportOptions
  pixels: Size
  downscaledTo: number | null
  onChange: (opts: ExportOptions) => void
  onClose: () => void
  /** The caret button that opened this menu - measured once on mount to
   * position the (fixed-position, see styles.css) popover under it. */
  anchorRef: RefObject<HTMLButtonElement | null>
}

/**
 * Settings for the Download button - PNG/JPG, 1x/2x/3x, JPG quality, plus
 * the output pixel size so a choice can be made before exporting (Phase 3).
 * Copy has none of this: it stays the fixed, zero-decision fast path
 * (see useCopyAction.ts), so this menu only ever affects Download.
 */
export function ExportMenu({ opts, pixels, downscaledTo, onChange, onClose, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
  }, [anchorRef])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const setFormat = (format: ExportFormat) => onChange({ ...opts, format })
  const setScale = (scale: 1 | 2 | 3) => onChange({ ...opts, scale })

  return (
    <div
      ref={ref}
      className="export-menu"
      role="dialog"
      aria-label={t('toolbar.exportOptions')}
      style={pos ? { top: pos.top, right: pos.right } : { visibility: 'hidden' }}
    >
      <div className="export-menu__row">
        <span className="export-menu__label">{t('export.format')}</span>
        <div className="group">
          <button className="chip" aria-pressed={opts.format === 'image/png'} onClick={() => setFormat('image/png')}>
            {t('export.formatPng')}
          </button>
          <button className="chip" aria-pressed={opts.format === 'image/jpeg'} onClick={() => setFormat('image/jpeg')}>
            {t('export.formatJpg')}
          </button>
        </div>
      </div>

      <div className="export-menu__row">
        <span className="export-menu__label">{t('export.scale')}</span>
        <div className="group">
          {SCALES.map((s) => (
            <button key={s} className="chip" aria-pressed={opts.scale === s} onClick={() => setScale(s)}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      {opts.format === 'image/jpeg' && (
        <label className="slider">
          {t('export.quality')}
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={opts.quality ?? 0.92}
            onChange={(e) => onChange({ ...opts, quality: Number(e.target.value) })}
            aria-label={t('export.quality')}
          />
        </label>
      )}

      <div className="export-menu__estimate">
        {t('export.estimate', { w: pixels.w, h: pixels.h })}
        {downscaledTo != null && (
          <div className="export-menu__warn">{t('export.willDownscale', { scale: downscaledTo })}</div>
        )}
      </div>
    </div>
  )
}
