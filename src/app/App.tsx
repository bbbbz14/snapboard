import { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from '@/ui/TopBar'
import { BoardCanvas } from '@/ui/BoardCanvas'
import { EmptyState } from '@/ui/EmptyState'
import { RecoveryBar } from '@/ui/RecoveryBar'
import { ClearedBar } from '@/ui/ClearedBar'
import { Toasts } from '@/ui/Toasts'
import { useBoardStore } from '@/board/store/boardStore'
import { usePasteImages, useDropImages } from '@/hooks/useImageInput'
import { useCopyAction } from '@/hooks/useCopyAction'
import { t } from '@/i18n/t'

export function App() {
  const board = useBoardStore((s) => s.board)
  const addFiles = useBoardStore((s) => s.addFiles)
  const hydrate = useBoardStore((s) => s.hydrate)
  const stageRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ w: 900, h: 600 })
  // Shared by TopBar's Copy button and BoardCanvas's Ctrl/Cmd+Shift+C shortcut
  // (Phase 2 item 9) - lifted here, the nearest common ancestor, so both see
  // the same "copied" button-state timer instead of each owning its own.
  const { copied, onCopy } = useCopyAction()

  const onFiles = useCallback((files: File[]) => void addFiles(files), [addFiles])
  usePasteImages(onFiles)
  const drag = useDropImages(onFiles)

  // Runs once, before the user can commit any action of their own - later
  // hydrates would risk clobbering an edit the user already made.
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (box) setViewport({ w: Math.max(1, box.width), h: Math.max(1, box.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="app">
      <TopBar copied={copied} onCopy={onCopy} />
      <RecoveryBar />
      <ClearedBar />
      <div className="stage" ref={stageRef}>
        {board.nodes.length === 0 ? (
          <EmptyState onFiles={onFiles} />
        ) : (
          <BoardCanvas board={board} viewport={viewport} onCopy={onCopy} />
        )}
      </div>
      {drag.dragging && <div className="dropzone">{t('drop.overlay', { count: drag.count })}</div>}
      <Toasts />
    </div>
  )
}
