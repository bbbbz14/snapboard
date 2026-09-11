import { useRef, useState } from 'react'
import { useBoardStore, toRenderInput } from '@/board/store/boardStore'
import { BACKGROUNDS, type BackgroundName, type LayoutMode, type StylePreset } from '@/board/model/types'
import { exportBoard, exportFilename } from '@/board/export/exportBoard'
import { copyImageToClipboard, downloadBlob } from '@/board/export/clipboard'
import { modKey, t } from '@/i18n/t'

const LAYOUTS: { mode: LayoutMode; label: string }[] = [
  { mode: 'auto', label: t('layout.auto') },
  { mode: 'rows', label: t('layout.rows') },
  { mode: 'columns', label: t('layout.columns') },
  { mode: 'grid', label: t('layout.grid') },
  { mode: 'steps', label: t('layout.steps') },
]

const SWATCHES: { name: BackgroundName; label: string; css: string }[] = [
  { name: 'white', label: t('background.white'), css: '#ffffff' },
  { name: 'black', label: t('background.black'), css: '#0b0f14' },
  { name: 'slate', label: t('background.slate'), css: '#eef2f7' },
  { name: 'transparent', label: t('background.transparent'), css: '' },
]

const STYLES: { key: StylePreset; label: string }[] = [
  { key: 'plain', label: t('style.plain') },
  { key: 'card', label: t('style.card') },
  { key: 'soft', label: t('style.soft') },
]

export function TopBar() {
  const board = useBoardStore((s) => s.board)
  const store = useBoardStore()
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)

  const hasImages = board.nodes.length > 0

  /** Renders at 2x: sharp on retina, and still comfortably inside the safe area. */
  const render = async () => {
    const result = await exportBoard(toRenderInput(board), { scale: 2, format: 'image/png' })
    if (result.downscaled) {
      store.toast(t('toast.exportDownscaled', { scale: result.appliedScale }), 'warn')
    }
    return result.blob
  }

  const onCopy = async () => {
    const filename = exportFilename('image/png')
    const outcome = await copyImageToClipboard(render, (blob) => downloadBlob(blob, filename))

    if (outcome.method === 'download') {
      store.toast(t('toast.copyFailed'), 'warn')
      return
    }
    setCopied(true)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600)
    store.toast(
      outcome.verified ? t('toast.copied', { mod: modKey() }) : t('toast.copiedUnverified'),
      'success',
    )
  }

  const onDownload = async () => {
    const name = exportFilename('image/png')
    downloadBlob(await render(), name)
    store.toast(t('toast.downloaded', { name }), 'success')
  }

  return (
    <header className="topbar">
      <span className="brand">{t('app.name')}</span>

      {hasImages && (
        <>
          <div className="group" aria-label={t('toolbar.background')}>
            {SWATCHES.map((s) => (
              <button
                key={s.name}
                className={`swatch${s.name === 'transparent' ? ' swatch--transparent' : ''}`}
                style={s.css ? { background: s.css } : undefined}
                title={s.label}
                aria-label={s.label}
                aria-pressed={isBackground(board.background, s.name)}
                onClick={() => store.setBackground(s.name)}
              />
            ))}
          </div>

          <div className="group" aria-label={t('toolbar.layout')}>
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

          <div className="group" aria-label={t('toolbar.style')}>
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

          <label className="slider">
            {t('spacing.gap')}
            <input
              type="range"
              min={0}
              max={80}
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
      )}

      <span className="spacer" />

      {hasImages && (
        <>
          <button className="btn" onClick={store.clear}>
            {t('toolbar.clear')}
          </button>
          {/* Download stays visible next to Copy: a silent clipboard failure is
              undetectable, so the user always needs a way out. See ADR-003. */}
          <button className="btn" onClick={onDownload}>
            {t('toolbar.download')}
          </button>
          <button className={`btn btn--primary${copied ? ' btn--done' : ''}`} onClick={onCopy}>
            {copied ? t('toolbar.copied') : t('toolbar.copy')}
          </button>
        </>
      )}
    </header>
  )
}

function isBackground(current: { type: string; color?: string }, name: BackgroundName): boolean {
  const target = BACKGROUNDS[name]
  if (target.type === 'transparent') return current.type === 'transparent'
  return current.type === 'solid' && current.color === target.color
}
