import { useCallback, useRef, useState } from 'react'
import { useBoardStore, toRenderInput } from '@/board/store/boardStore'
import { exportBoard, exportFilename } from '@/board/export/exportBoard'
import { copyImageToClipboard, downloadBlob } from '@/board/export/clipboard'
import { modKey, t } from '@/i18n/t'

/** Renders at 2x: sharp on retina, and still comfortably inside the safe area. */
export function useExportRender(): () => Promise<Blob> {
  const board = useBoardStore((s) => s.board)
  const toast = useBoardStore((s) => s.toast)
  return useCallback(async () => {
    const result = await exportBoard(toRenderInput(board), { scale: 2, format: 'image/png' })
    if (result.downscaled) toast(t('toast.exportDownscaled', { scale: result.appliedScale }), 'warn')
    return result.blob
  }, [board, toast])
}

/**
 * Copy is triggered from two places (TopBar's button and, from Phase 2 item
 * 9, BoardCanvas's Ctrl/Cmd+Shift+C shortcut) - lifted out of TopBar so both
 * share one clipboard call and one "copied" button-state timer instead of
 * TopBar owning state a sibling component can't see.
 */
export function useCopyAction(): { copied: boolean; onCopy: () => Promise<void> } {
  const render = useExportRender()
  const toast = useBoardStore((s) => s.toast)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)

  const onCopy = useCallback(async () => {
    const filename = exportFilename('image/png')
    const outcome = await copyImageToClipboard(render, (blob) => downloadBlob(blob, filename))

    if (outcome.method === 'download') {
      toast(t('toast.copyFailed'), 'warn')
      return
    }
    setCopied(true)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600)
    toast(outcome.verified ? t('toast.copied', { mod: modKey() }) : t('toast.copiedUnverified'), 'success')
  }, [render, toast])

  return { copied, onCopy }
}
