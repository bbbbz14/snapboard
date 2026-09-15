import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import type { MessageKey } from '@/i18n/en'
import { modKey, t } from '@/i18n/t'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props {
  onClose: () => void
}

interface Section {
  title: MessageKey
  rows: { keys: string; label: string }[]
}

/**
 * Static reference built by hand from BoardCanvas.tsx's own keydown
 * handler(s) - every binding it currently owns, grouped the way a user
 * thinks about them rather than the order the handler checks them in.
 * Update this list if a shortcut is ever added, renamed, or removed there
 * (Phase 5 item 8's own note: by the time this was built the shortcut set
 * was already stable, so this is meant to be a one-time list, not something
 * that grows a maintenance burden per future item).
 */
function sections(): Section[] {
  const mod = modKey()
  return [
    {
      title: 'help.sectionGeneral',
      rows: [
        { keys: '?', label: t('help.openHelp') },
        { keys: 'Esc', label: t('help.escape') },
        { keys: `${mod}+Z`, label: t('help.undo') },
        { keys: `${mod}+Shift+Z`, label: t('help.redo') },
        { keys: `${mod}+Shift+C`, label: t('help.copy') },
      ],
    },
    {
      title: 'help.sectionView',
      rows: [
        { keys: '+', label: t('help.zoomIn') },
        { keys: '-', label: t('help.zoomOut') },
        { keys: '0', label: t('help.fit') },
        { keys: '1', label: t('help.reset100') },
        { keys: 'Space (hold) + drag', label: t('help.pan') },
      ],
    },
    {
      title: 'help.sectionSelection',
      rows: [
        { keys: 'D', label: t('help.duplicate') },
        { keys: 'F', label: t('help.bringToFront') },
        { keys: 'Del / Backspace', label: t('help.delete') },
      ],
    },
    {
      title: 'help.sectionTools',
      rows: [
        { keys: 'A', label: t('help.arrow') },
        { keys: 'L', label: t('help.line') },
        { keys: 'R', label: t('help.box') },
        { keys: 'T', label: t('help.text') },
        { keys: 'N', label: t('help.marker') },
        { keys: 'C', label: t('help.redact') },
      ],
    },
    {
      title: 'help.sectionEditing',
      rows: [
        { keys: `${mod}+Enter`, label: t('help.commitText') },
        { keys: 'Enter', label: t('help.confirmCrop') },
      ],
    },
  ]
}

/**
 * Full-screen shortcut cheatsheet, opened with `?` (App.tsx's own global
 * listener - it must work from the empty-board state too, unlike every
 * shortcut in BoardCanvas.tsx, which only mounts once there's a node to act
 * on) or the small help button in `TopBar`. Unlike the anchored popovers
 * (ExportMenu/BackgroundMenu/AnnotationSettingsPopover), this is a true
 * modal meant to be read for a moment, not a quick task-focused menu - so
 * unlike them, it swallows every keydown that reaches its own backdrop
 * (bar Escape) rather than letting it bubble to BoardCanvas's global
 * shortcut handler underneath. Without that, e.g. pressing "A" while
 * reading the "Arrow tool (A)" row would arm the arrow tool on the board
 * behind this modal - only the tag-name guard (INPUT/TEXTAREA/SELECT)
 * protects BoardCanvas's plain-key shortcuts today, and this modal's own
 * focusable children (Close button, the rows themselves) are none of those.
 */
export function HelpModal({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useFocusTrap(ref, anchorRef)

  // A real native listener on the backdrop's own DOM node, not React's
  // `onKeyDown` prop - that prop is delegated through React's root-level
  // listener, and relying on its `stopPropagation` to reliably keep an event
  // from ever reaching `window` (where BoardCanvas's global shortcuts live)
  // turned out not to hold up in practice (found by this modal's own e2e
  // tests: "A" pressed while open still armed the arrow tool underneath, and
  // Escape stopped closing the modal at all once a stray stopPropagation was
  // added). A listener attached directly to this real DOM node is
  // guaranteed by the DOM's own bubble order to run after useFocusTrap's own
  // Tab-handling (attached to `ref.current`, a descendant) and before
  // anything outside this subtree, including `window` - no dependence on
  // React's internal event delegation. Handles Escape itself rather than
  // also relying on a separate `document`-level listener, so there's only
  // one place this logic can go wrong.
  useEffect(() => {
    const el = backdropRef.current
    if (!el) return
    const onKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Safety net for a real, WebKit-only race this modal's own e2e coverage
  // caught: `useFocusTrap`'s `requestAnimationFrame` (which moves focus into
  // the modal on open) can still be pending when the very next key is
  // pressed, so the event's target is still whatever had focus *before* the
  // modal opened - outside this subtree entirely. The bubble listener above
  // never sees that event at all (its target's ancestor chain doesn't pass
  // through `.help-backdrop`), so "A" reached BoardCanvas's global shortcut
  // and armed the arrow tool underneath, on WebKit only. A capture-phase
  // listener on `window` is the first stop in the entire event path
  // regardless of the target, so it catches this case unconditionally - but
  // it must step aside for anything whose target is already inside the
  // modal, or it would stop Tab-trap navigation and the Close button's own
  // keyboard activation from ever reaching them at all.
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (backdropRef.current?.contains(e.target as Node)) return
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onWindowKeyDown, true)
    return () => window.removeEventListener('keydown', onWindowKeyDown, true)
  }, [onClose])

  const onBackdropMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div ref={backdropRef} className="help-backdrop" onMouseDown={onBackdropMouseDown}>
      <div ref={ref} role="dialog" aria-label={t('help.title')} tabIndex={-1} className="help-modal">
        <div className="help-modal__header">
          <h2>{t('help.title')}</h2>
          <button className="help-modal__close" aria-label={t('help.close')} onClick={onClose}>
            ✕
          </button>
        </div>
        {sections().map((section) => (
          <div key={section.title} className="help-modal__section">
            <div className="help-modal__section-title">{t(section.title)}</div>
            {section.rows.map((row) => (
              <div key={row.label} className="help-modal__row">
                <span>{row.label}</span>
                <kbd className="help-modal__key">{row.keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
