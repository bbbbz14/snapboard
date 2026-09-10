export type CopyMethod = 'clipboard' | 'download'

export interface CopyOutcome {
  method: CopyMethod
  /**
   * True only where a copy was independently confirmed. Firefox resolves
   * write() with an empty clipboard, so a resolved promise is not proof —
   * see ADR-003. The UI must keep Download visible regardless.
   */
  verified: boolean
  error?: string
}

export function canUseClipboardImage(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.write !== 'function') return false
  if (typeof ClipboardItem === 'undefined') return false
  if (typeof ClipboardItem.supports === 'function' && !ClipboardItem.supports('image/png')) return false
  return true
}

/** Chromium-family engines are the only ones where copy was verified end to end. */
export function isCopyVerifiable(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua)
}

/**
 * Copies a rendered image to the clipboard, falling back to a download.
 *
 * `render` must be passed unawaited: handing the promise to ClipboardItem is
 * what preserves user activation on Safari. Awaiting it first breaks the copy.
 */
export async function copyImageToClipboard(
  render: () => Promise<Blob>,
  fallback: (blob: Blob) => void,
): Promise<CopyOutcome> {
  if (!canUseClipboardImage()) {
    fallback(await render())
    return { method: 'download', verified: true, error: 'Clipboard images are not supported in this browser' }
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': render() })])
    return { method: 'clipboard', verified: isCopyVerifiable() }
  } catch (e) {
    fallback(await render())
    return { method: 'download', verified: true, error: String(e) }
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeFilename(filename)
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Strip C0/C1 control characters; they are invisible in a filename and can
// confuse download handling.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g
const PATH_CHARS = /[\\/:*?"<>|]/g

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(CONTROL_CHARS, '')
    .replace(PATH_CHARS, '-')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120)
  return cleaned || 'snapboard.png'
}
