import { useBoardStore } from '@/board/store/boardStore'
import { t } from '@/i18n/t'

/** The misclick safety net for the Clear board button - distinct from
 * RecoveryBar's "you left with unsaved work" case, this shows the instant
 * `clear()` runs (same session) and survives a reload too, via a separate
 * IndexedDB snapshot (see boardStore.clear / autosave.saveLastCleared). */
export function ClearedBar() {
  const lastCleared = useBoardStore((s) => s.lastCleared)
  const restoreLastCleared = useBoardStore((s) => s.restoreLastCleared)
  const dismissLastCleared = useBoardStore((s) => s.dismissLastCleared)

  if (!lastCleared) return null

  return (
    <div className="recovery-bar" role="status">
      <span>{t('cleared.message')}</span>
      <button className="link" onClick={restoreLastCleared}>
        {t('cleared.restore')}
      </button>
      <button className="recovery-dismiss" onClick={dismissLastCleared} aria-label={t('cleared.dismiss')}>
        &times;
      </button>
    </div>
  )
}
