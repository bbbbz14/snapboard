import { useBoardStore } from '@/board/store/boardStore'
import { t } from '@/i18n/t'

export function RecoveryBar() {
  const recoveredBoard = useBoardStore((s) => s.recoveredBoard)
  const dismissRecovery = useBoardStore((s) => s.dismissRecovery)
  const startFresh = useBoardStore((s) => s.startFresh)

  if (!recoveredBoard) return null

  return (
    <div className="recovery-bar" role="status">
      <span>{t('recovery.message')}</span>
      <button className="link" onClick={startFresh}>
        {t('recovery.startFresh')}
      </button>
      <button className="recovery-dismiss" onClick={dismissRecovery} aria-label={t('recovery.dismiss')}>
        &times;
      </button>
    </div>
  )
}
