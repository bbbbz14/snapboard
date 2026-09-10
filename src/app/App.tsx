import { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from '@/ui/TopBar'
import { BoardCanvas } from '@/ui/BoardCanvas'
import { EmptyState } from '@/ui/EmptyState'
import { Toasts } from '@/ui/Toasts'
import { useBoardStore } from '@/board/store/boardStore'
import { usePasteImages, useDropImages } from '@/hooks/useImageInput'
import { t } from '@/i18n/t'

export function App() {
  const board = useBoardStore((s) => s.board)
  const addFiles = useBoardStore((s) => s.addFiles)
  const stageRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ w: 900, h: 600 })

  const onFiles = useCallback((files: File[]) => void addFiles(files), [addFiles])
  usePasteImages(onFiles)
  const drag = useDropImages(onFiles)

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
      <TopBar />
      <div className="stage" ref={stageRef}>
        {board.nodes.length === 0 ? (
          <EmptyState onFiles={onFiles} />
        ) : (
          <BoardCanvas board={board} viewport={viewport} />
        )}
      </div>
      {drag.dragging && <div className="dropzone">{t('drop.overlay', { count: drag.count })}</div>}
      <Toasts />
    </div>
  )
}
