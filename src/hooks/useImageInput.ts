import { useEffect, useState } from 'react'

/** Pulls image files out of a paste or drop payload, ignoring anything else. */
export function extractFiles(dt: DataTransfer | null): File[] {
  if (!dt) return []
  const files: File[] = []
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  if (files.length === 0 && dt.files.length > 0) files.push(...Array.from(dt.files))
  return files
}

/**
 * Paste is the primary way images arrive: most screenshots are taken with
 * Win+Shift+S or Cmd+Ctrl+Shift+4 and never reach the file system.
 */
export function usePasteImages(onFiles: (files: File[]) => void): void {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const files = extractFiles(e.clipboardData)
      if (files.length > 0) {
        e.preventDefault()
        onFiles(files)
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [onFiles])
}

/** Window-wide drop target, so the user never has to aim at a small zone. */
export function useDropImages(onFiles: (files: File[]) => void): { dragging: boolean; count: number } {
  const [state, setState] = useState({ dragging: false, count: 0 })

  useEffect(() => {
    // Nested elements fire dragleave constantly; counting entries is the only
    // reliable way to know the pointer has really left the window.
    let depth = 0

    const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      depth++
      setState({ dragging: true, count: e.dataTransfer?.items.length ?? 0 })
    }
    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setState({ dragging: false, count: 0 })
    }
    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      depth = 0
      setState({ dragging: false, count: 0 })
      const files = extractFiles(e.dataTransfer)
      if (files.length > 0) onFiles(files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [onFiles])

  return state
}
