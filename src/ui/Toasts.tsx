import { useBoardStore } from '@/board/store/boardStore'
import { t } from '@/i18n/t'

export function Toasts() {
  const toasts = useBoardStore((s) => s.toasts)
  const busy = useBoardStore((s) => s.busy)

  return (
    <>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
      {busy && busy.total > 0 && (
        <div className="busy" role="status" aria-live="polite">
          {t('toast.decoding', { done: busy.done, total: busy.total })}
        </div>
      )}
    </>
  )
}
