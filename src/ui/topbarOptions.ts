import type { LayoutMode, StylePreset } from '@/board/model/types'
import { t } from '@/i18n/t'

/**
 * Shared between `TopBar` (desktop, inline) and `MobileSettingsMenu` (mobile,
 * grouped into one popover) so the two never drift apart - pulled out once
 * both needed the same lists, rather than each defining its own copy.
 */
export const LAYOUTS: { mode: LayoutMode; label: string }[] = [
  { mode: 'auto', label: t('layout.auto') },
  { mode: 'rows', label: t('layout.rows') },
  { mode: 'columns', label: t('layout.columns') },
  { mode: 'grid', label: t('layout.grid') },
  { mode: 'steps', label: t('layout.steps') },
]

export const STYLES: { key: StylePreset; label: string }[] = [
  { key: 'plain', label: t('style.plain') },
  { key: 'card', label: t('style.card') },
  { key: 'soft', label: t('style.soft') },
]

/** The gap slider's own range (px) - also the denominator for the %
 * shown next to it, so the two never drift apart. */
export const GAP_MAX = 80
