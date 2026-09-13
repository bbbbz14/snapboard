import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { BACKGROUNDS, type Background, type BackgroundName } from '@/board/model/types'
import { t } from '@/i18n/t'

const NAMES = Object.keys(BACKGROUNDS) as BackgroundName[]

/** Board content, not chrome - same reasoning `--annotation`/`--checker*`
 * already established for never following the OS theme, which is why this
 * is a plain inline style built from the stored color(s) rather than a set
 * of CSS classes per preset. */
export function backgroundSwatchStyle(bg: Background): CSSProperties | undefined {
  if (bg.type === 'solid') return { background: bg.color }
  if (bg.type === 'gradient') return { background: `linear-gradient(135deg, ${bg.from}, ${bg.to})` }
  return undefined
}

export function isBackground(current: Background, name: BackgroundName): boolean {
  const target = BACKGROUNDS[name]
  if (target.type === 'transparent') return current.type === 'transparent'
  if (target.type === 'gradient') return current.type === 'gradient' && current.from === target.from && current.to === target.to
  return current.type === 'solid' && current.color === target.color
}

interface Props {
  current: Background
  onChange: (name: BackgroundName) => void
  onClose: () => void
  /** The toggle button that opened this menu - measured once on mount to
   * position the (fixed-position, see styles.css) popover under it, same
   * pattern as ExportMenu.tsx. */
  anchorRef: RefObject<HTMLButtonElement | null>
}

/**
 * Picks the board background - 3 flat presets plus 6 gradients (Phase 5
 * item 4) - from a popover rather than 9 inline swatches in the top bar,
 * which would make the standing mobile-overflow finding worse (item 3's
 * own note). Reuses the `.swatch` styling the inline version already had.
 */
export function BackgroundMenu({ current, onChange, onClose, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left })
  }, [anchorRef])

  useEffect(() => {
    // Same pattern as ExportMenu.tsx, including not special-casing the
    // anchor button itself: a click there both closes (this listener) and
    // toggles (the button's own onClick) in the same event, which nets out
    // to "closed" - relying on that, not fighting it, is what lets the
    // button's click handler stay a simple toggle.
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

  return (
    <div
      ref={ref}
      className="background-menu"
      role="dialog"
      aria-label={t('toolbar.background')}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
    >
      {NAMES.map((name) => (
        <button
          key={name}
          className={`swatch${name === 'transparent' ? ' swatch--transparent' : ''}`}
          style={backgroundSwatchStyle(BACKGROUNDS[name])}
          title={t(`background.${name}`)}
          aria-label={t(`background.${name}`)}
          aria-pressed={isBackground(current, name)}
          onClick={() => {
            onChange(name)
            onClose()
          }}
        />
      ))}
    </div>
  )
}
