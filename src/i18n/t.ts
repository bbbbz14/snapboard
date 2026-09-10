import { en, type MessageKey } from './en'

/** Minimal interpolation: {{name}} placeholders only. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template: string = en[key]
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''))
}

export const isApple = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export const modKey = (): string => (isApple() ? 'Cmd' : 'Ctrl')
