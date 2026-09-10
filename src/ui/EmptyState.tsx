import { useRef } from 'react'
import { modKey, t } from '@/i18n/t'

interface Props {
  onFiles: (files: File[]) => void
}

export function EmptyState({ onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="empty">
      <kbd>{t('empty.shortcut', { mod: modKey() })}</kbd>
      <h2>{t('empty.title')}</h2>
      <p>{t('empty.or')}</p>
      <button className="btn" onClick={() => input.current?.click()}>
        {t('empty.browse')}
      </button>
      <p className="privacy">{t('empty.privacy')}</p>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </div>
  )
}
