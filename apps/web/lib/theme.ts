/**
 * Client-side theme helpers. The source of truth for the rendered mode
 * is the `data-mode` attribute on `<html>`. The inline script in
 * app/layout.tsx sets it before paint by reading localStorage so there
 * is no flash of the wrong theme.
 *
 * For signed-in users we also mirror the choice to profile.theme_preference
 * (see app/(app)/settings/theme-actions.ts) so the preference follows
 * across devices.
 */

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'

const VALID: readonly Theme[] = ['light', 'dark', 'system'] as const

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (VALID as readonly string[]).includes(value)
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(raw)) return raw
  } catch {
    // localStorage access can throw in some embedded contexts. Fall through.
  }
  return 'system'
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // ignore
  }
  applyTheme(theme)
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  root.setAttribute('data-mode', resolved)
  root.style.colorScheme = resolved
}

export function resolvedTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  const stored = getStoredTheme()
  if (stored === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return stored
}

export function themeLabel(theme: Theme): string {
  if (theme === 'light') return 'Light'
  if (theme === 'dark') return 'Dark'
  return 'System'
}
