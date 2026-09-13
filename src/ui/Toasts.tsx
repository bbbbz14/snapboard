import { useEffect, useRef, useState } from 'react'
import { useBoardStore, type Toast } from '@/board/store/boardStore'
import { t } from '@/i18n/t'

// Must match the `.toast--exiting` transition duration in styles.css.
const TOAST_EXIT_MS = 160

interface DisplayedToast extends Toast {
  exiting: boolean
}

/**
 * Mirrors the store's `toasts` array in local state instead of rendering it
 * directly, so a dismissed toast (auto-timeout or manual) can keep its DOM
 * node mounted for one exit-animation beat instead of disappearing the
 * instant the store removes it - the same fade the entrance already had
 * (`toast-in`) but for leaving too (Phase 5 item 9). No focus-trap/open-close
 * invariant to worry about here, unlike the anchored popovers - a toast is
 * just a status message, so delaying its unmount by a beat is risk-free.
 */
export function Toasts() {
  const toasts = useBoardStore((s) => s.toasts)
  const busy = useBoardStore((s) => s.busy)
  const [displayed, setDisplayed] = useState<DisplayedToast[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const liveIds = new Set(toasts.map((x) => x.id))
    setDisplayed((prev) => {
      const kept = prev.map((d) => (liveIds.has(d.id) ? d : { ...d, exiting: true }))
      for (const d of kept) {
        if (d.exiting && !timers.current.has(d.id)) {
          timers.current.set(
            d.id,
            setTimeout(() => {
              setDisplayed((cur) => cur.filter((x) => x.id !== d.id))
              timers.current.delete(d.id)
            }, TOAST_EXIT_MS),
          )
        }
      }
      const keptIds = new Set(kept.map((d) => d.id))
      const added = toasts.filter((x) => !keptIds.has(x.id)).map((x) => ({ ...x, exiting: false }))
      return added.length > 0 ? [...kept, ...added] : kept
    })
  }, [toasts])

  useEffect(() => {
    const map = timers.current
    return () => {
      for (const timer of map.values()) clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <div className="toasts" role="status" aria-live="polite">
        {displayed.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}${toast.exiting ? ' toast--exiting' : ''}`}>
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
