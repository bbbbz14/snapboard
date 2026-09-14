import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { BACKGROUNDS, type Background, type BackgroundName, type Board } from '@/board/model/types'
import { backgroundSwatchStyle, isBackground } from '@/ui/BackgroundMenu'
import { LAYOUTS, STYLES, GAP_MAX } from '@/ui/topbarOptions'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { t } from '@/i18n/t'

const NAMES = Object.keys(BACKGROUNDS) as BackgroundName[]

interface Props {
  board: Board
  onSetLayout: (mode: Board['layout']) => void
  onTurnAutoOn: () => void
  onSetStyle: (key: Board['style']) => void
  onSetGap: (gap: number) => void
  onGapAdjustStart: () => void
  onGapAdjustEnd: () => void
  onSetBackground: (name: BackgroundName) => void
  /** Clear board - folded in here too, not because it's a "settings" value
   * like the four above, but because it was the other thing (alongside the
   * app-name brand, see styles.css) that had to leave the main row for the
   * bar to fit a 390px viewport without `.topbar`'s own overflow-scroll
   * fallback kicking in - see the arithmetic in this revision's own e2e
   * test. It's rare and already gated behind a native `confirm()`, so one
   * extra tap to reach it costs little. */
  onClear: () => void
  onClose: () => void
  /** The settings icon button that opened this menu - same anchored-position
   * pattern as `ExportMenu`/`BackgroundMenu`. */
  anchorRef: RefObject<HTMLButtonElement | null>
}

/**
 * Mobile-only (see `TopBar`'s own `isMobile` branch): the same
 * Background/Layout/Style/Gap controls the desktop top bar shows inline,
 * folded into one popover behind a single settings icon instead. On a narrow
 * viewport those four controls alone are wide enough to force the bar into
 * horizontal scrolling (the standing finding item 3 only ever floored, never
 * fixed) - real-usage feedback asked for something that doesn't need
 * scrolling at all, so this trades "always visible" for "one tap away."
 *
 * Deliberately does not auto-close after a single choice the way the
 * standalone `BackgroundMenu` does - this panel bundles four different
 * controls, and a user is far more likely to touch more than one of them in
 * a row (pick a layout, then a style, then nudge the gap) than to want it to
 * snap shut after the very first tap.
 */
export function MobileSettingsMenu({
  board,
  onSetLayout,
  onTurnAutoOn,
  onSetStyle,
  onSetGap,
  onGapAdjustStart,
  onGapAdjustEnd,
  onSetBackground,
  onClear,
  onClose,
  anchorRef,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const gapId = useId()
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useFocusTrap(ref, anchorRef)

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left })
  }, [anchorRef])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && e.target !== anchorRef.current) onClose()
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
  }, [onClose, anchorRef])

  const backgroundStyle = (name: BackgroundName): Background => BACKGROUNDS[name]

  return (
    <div
      ref={ref}
      className="mobile-settings-menu"
      role="dialog"
      aria-label={t('toolbar.settings')}
      tabIndex={-1}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
    >
      <div className="mobile-settings-menu__section">
        <span className="mobile-settings-menu__label">{t('toolbar.background')}</span>
        <div className="mobile-settings-menu__swatches" role="group" aria-label={t('toolbar.background')}>
          {NAMES.map((name) => (
            <button
              key={name}
              className={`swatch${name === 'transparent' ? ' swatch--transparent' : ''}`}
              style={backgroundSwatchStyle(backgroundStyle(name))}
              title={t(`background.${name}`)}
              aria-label={t(`background.${name}`)}
              aria-pressed={isBackground(board.background, name)}
              onClick={() => onSetBackground(name)}
            />
          ))}
        </div>
      </div>

      <div className="mobile-settings-menu__section">
        <span className="mobile-settings-menu__label">{t('toolbar.layout')}</span>
        {board.layout === 'free' ? (
          <span className="free-banner" role="status">
            {t('layout.freeNotice')}
            <button className="link" onClick={onTurnAutoOn}>
              {t('layout.turnOn')}
            </button>
          </span>
        ) : (
          <div className="group" role="group" aria-label={t('toolbar.layout')}>
            {LAYOUTS.map((l) => (
              <button
                key={l.mode}
                className="chip"
                aria-pressed={board.layout === l.mode}
                onClick={() => onSetLayout(l.mode)}
                title={l.mode === 'auto' ? `${l.label} (${board.resolvedLayout})` : l.label}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mobile-settings-menu__section">
        <span className="mobile-settings-menu__label">{t('toolbar.style')}</span>
        <div className="group" role="group" aria-label={t('toolbar.style')}>
          {STYLES.map((s) => (
            <button key={s.key} className="chip" aria-pressed={board.style === s.key} onClick={() => onSetStyle(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <label className="slider" htmlFor={gapId}>
        {t('spacing.gapWithPercent', { percent: Math.round((board.gap / GAP_MAX) * 100) })}
        <input
          id={gapId}
          type="range"
          min={0}
          max={GAP_MAX}
          value={board.gap}
          onChange={(e) => onSetGap(Number(e.target.value))}
          onPointerDown={onGapAdjustStart}
          onPointerUp={onGapAdjustEnd}
          onKeyDown={onGapAdjustStart}
          onKeyUp={onGapAdjustEnd}
          aria-label={t('spacing.gap')}
        />
      </label>

      <button className="btn mobile-settings-menu__clear" onClick={onClear}>
        {t('toolbar.clear')}
      </button>
    </div>
  )
}
