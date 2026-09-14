import { useEffect, useId, useRef, useState } from 'react'
import { useBoardStore, toRenderInput } from '@/board/store/boardStore'
import { exportBoard, exportFilename, estimatePixels, resolveScale, type ExportOptions } from '@/board/export/exportBoard'
import { downloadBlob } from '@/board/export/clipboard'
import { ExportMenu } from '@/ui/ExportMenu'
import { BackgroundMenu, backgroundSwatchStyle } from '@/ui/BackgroundMenu'
import { MobileSettingsMenu } from '@/ui/MobileSettingsMenu'
import { LAYOUTS, STYLES, GAP_MAX } from '@/ui/topbarOptions'
import { useIsMobile } from '@/hooks/useIsMobile'
import { modKey, t } from '@/i18n/t'

interface Props {
  copied: boolean
  onCopy: () => void
  /** Opens the shortcut cheatsheet (HelpModal), lifted to App.tsx since it
   * must also work from the empty-board state, unlike every other action in
   * this bar. */
  onHelp: () => void
}

export function TopBar({ copied, onCopy, onHelp }: Props) {
  const isMobile = useIsMobile()
  const board = useBoardStore((s) => s.board)
  const store = useBoardStore()
  const gapId = useId()
  const [exportOpts, setExportOpts] = useState<ExportOptions>({ scale: 2, format: 'image/png', quality: 0.92 })
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false)
  // Mobile only (see the `isMobile` branch below) - Background/Layout/Style/
  // Gap folded into one popover instead of shown inline, so the bar itself
  // never has to scroll to reach them.
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const caretRef = useRef<HTMLButtonElement>(null)
  const backgroundBtnRef = useRef<HTMLButtonElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  // The bar itself scrolls now (item 3) - if it scrolls while a popover
  // anchored to one of its buttons is open, the popover (position: fixed,
  // see ExportMenu.tsx/BackgroundMenu.tsx/MobileSettingsMenu.tsx) would
  // visually detach from the button that anchored it. Simplest correct
  // behavior: close it, same as an outside click already does.
  useEffect(() => {
    if (!exportMenuOpen && !backgroundMenuOpen && !settingsMenuOpen) return
    const header = headerRef.current
    if (!header) return
    const onScroll = () => {
      setExportMenuOpen(false)
      setBackgroundMenuOpen(false)
      setSettingsMenuOpen(false)
    }
    header.addEventListener('scroll', onScroll)
    return () => header.removeEventListener('scroll', onScroll)
  }, [exportMenuOpen, backgroundMenuOpen, settingsMenuOpen])

  const hasImages = board.nodes.length > 0

  // Shown ahead of time in the menu below, from the same pure guard
  // exportBoard applies for real (invariant-adjacent: one source of truth
  // for "will this get downscaled", see ADR-005).
  const resolved = resolveScale(board.size, exportOpts.scale)
  const estimatedPixels = estimatePixels(board.size, resolved.scale)

  const onDownload = async () => {
    const result = await exportBoard(toRenderInput(board), exportOpts)
    if (result.downscaled) store.toast(t('toast.exportDownscaled', { scale: result.appliedScale }), 'warn')
    const name = exportFilename(exportOpts.format)
    downloadBlob(result.blob, name)
    store.toast(t('toast.downloaded', { name }), 'success')
  }

  // A blocking confirm, not just relying on undo/the "Board cleared" bar:
  // those are the safety net for a misclick, this is what stops one.
  const onClear = () => {
    if (window.confirm(t('toolbar.clearConfirm', { mod: modKey() }))) store.clear()
  }

  return (
    <header className="topbar" ref={headerRef}>
      <span className="brand">{t('app.name')}</span>

      {hasImages && (
        isMobile ? (
          // Background/Layout/Style/Gap are the four controls wide enough,
          // combined, to force the bar into horizontal scrolling on a narrow
          // viewport (item 3 only ever floored that, never fixed it) - real-
          // usage feedback on the live site asked for something that never
          // needs scrolling. Folded into one popover behind a single icon
          // instead of shown inline; see MobileSettingsMenu's own note.
          <div className="topbar-settings">
            <button
              ref={settingsBtnRef}
              className="btn"
              aria-label={t('toolbar.settings')}
              title={t('toolbar.settings')}
              aria-expanded={settingsMenuOpen}
              onClick={() => setSettingsMenuOpen((v) => !v)}
            >
              ⚙
            </button>
            {settingsMenuOpen && (
              <MobileSettingsMenu
                board={board}
                onSetLayout={store.setLayout}
                onTurnAutoOn={() => store.setLayout('auto')}
                onSetStyle={store.setStyle}
                onSetGap={store.setGap}
                onGapAdjustStart={store.beginAdjustment}
                onGapAdjustEnd={store.endAdjustment}
                onSetBackground={store.setBackground}
                onClear={onClear}
                onClose={() => setSettingsMenuOpen(false)}
                anchorRef={settingsBtnRef}
              />
            )}
          </div>
        ) : (
          <>
            <div className="background-picker">
              <button
                ref={backgroundBtnRef}
                className="btn"
                aria-label={t('toolbar.background')}
                aria-expanded={backgroundMenuOpen}
                onClick={() => setBackgroundMenuOpen((v) => !v)}
              >
                <span
                  className={`swatch swatch--preview${board.background.type === 'transparent' ? ' swatch--transparent' : ''}`}
                  style={backgroundSwatchStyle(board.background)}
                />
                {t('toolbar.background')}
              </button>
              {backgroundMenuOpen && (
                <BackgroundMenu
                  current={board.background}
                  onChange={(name) => store.setBackground(name)}
                  onClose={() => setBackgroundMenuOpen(false)}
                  anchorRef={backgroundBtnRef}
                />
              )}
            </div>

            <div className="group" role="group" aria-label={t('toolbar.layout')}>
              {board.layout === 'free' ? (
                // The first manual move/resize flips layout to 'free' (see
                // boardStore.setFrames) - relayout() then refuses to touch the
                // board (invariant 4), so this is the only way back to auto.
                <span className="free-banner" role="status">
                  {t('layout.freeNotice')}
                  <button className="link" onClick={() => store.setLayout('auto')}>
                    {t('layout.turnOn')}
                  </button>
                </span>
              ) : (
                LAYOUTS.map((l) => (
                  <button
                    key={l.mode}
                    className="chip"
                    aria-pressed={board.layout === l.mode}
                    onClick={() => store.setLayout(l.mode)}
                    title={l.mode === 'auto' ? `${l.label} (${board.resolvedLayout})` : l.label}
                  >
                    {l.label}
                  </button>
                ))
              )}
            </div>

            <div className="group" role="group" aria-label={t('toolbar.style')}>
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  className="chip"
                  aria-pressed={board.style === s.key}
                  onClick={() => store.setStyle(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <label className="slider" htmlFor={gapId}>
              {t('spacing.gapWithPercent', { percent: Math.round((board.gap / GAP_MAX) * 100) })}
              <input
                id={gapId}
                type="range"
                min={0}
                max={GAP_MAX}
                value={board.gap}
                onChange={(e) => store.setGap(Number(e.target.value))}
                onPointerDown={store.beginAdjustment}
                onPointerUp={store.endAdjustment}
                onKeyDown={store.beginAdjustment}
                onKeyUp={store.endAdjustment}
                aria-label={t('spacing.gap')}
              />
            </label>
          </>
        )
      )}

      <span className="spacer" />

      {hasImages && (
        <>
          {/* Folded into the settings popover on mobile instead (see the
              `isMobile` branch above and MobileSettingsMenu.tsx) - it was
              one of the two things (along with the brand text, see
              styles.css) that had to leave the main row for the bar to fit
              without scrolling. */}
          {!isMobile && (
            <button className="btn" onClick={onClear}>
              {t('toolbar.clear')}
            </button>
          )}
          {/* Download stays visible next to Copy: a silent clipboard failure is
              undetectable, so the user always needs a way out. See ADR-003. */}
          <div className="split-btn">
            <button className="btn" onClick={onDownload}>
              {t('toolbar.download')}
            </button>
            <button
              ref={caretRef}
              className="btn split-btn__caret"
              aria-label={t('toolbar.exportOptions')}
              aria-expanded={exportMenuOpen}
              onClick={() => setExportMenuOpen((v) => !v)}
            >
              ▾
            </button>
            {exportMenuOpen && (
              <ExportMenu
                opts={exportOpts}
                pixels={estimatedPixels}
                downscaledTo={resolved.downscaled ? resolved.scale : null}
                onChange={setExportOpts}
                onClose={() => setExportMenuOpen(false)}
                anchorRef={caretRef}
              />
            )}
          </div>
          <button
            className={`btn btn--primary${copied ? ' btn--done' : ''}`}
            title={t('toolbar.copyTitle', { mod: modKey() })}
            onClick={onCopy}
          >
            {copied ? t('toolbar.copied') : t('toolbar.copy')}
          </button>
        </>
      )}
      {/* Unconditional (unlike everything else above, gated on `hasImages`)
          - a first-time user on the empty state is exactly who most needs
          the cheatsheet. */}
      <button className="btn" aria-label={t('help.openButton')} title={t('help.openButton')} onClick={onHelp}>
        ?
      </button>
    </header>
  )
}
