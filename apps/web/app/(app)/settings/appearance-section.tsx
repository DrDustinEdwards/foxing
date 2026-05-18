'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  applyTheme,
  resolvedTheme,
  setStoredTheme,
  type ResolvedTheme,
  type Theme,
} from '@/lib/theme'
import { saveThemePreference } from './theme-actions'

interface Props {
  initial?: Theme
}

export function AppearanceSection({ initial }: Props) {
  const [current, setCurrent] = useState<ResolvedTheme>(() =>
    initial === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    setCurrent(resolvedTheme())
  }, [])

  function handleToggle() {
    const next: ResolvedTheme = current === 'light' ? 'dark' : 'light'
    setCurrent(next)
    setStoredTheme(next)
    applyTheme(next)
    void saveThemePreference(next)
  }

  const isDark = current === 'dark'

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <div className="flex flex-col">
        <span className="font-dm-sans text-sm font-medium text-text-primary">
          Dark mode
        </span>
        <span className="font-dm-sans text-xs text-text-tertiary">
          Switch between light and dark appearance.
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          isDark
            ? 'bg-[var(--toggle-on)] hover:bg-[var(--toggle-on-hover)]'
            : 'bg-border-default hover:bg-border-strong',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-bg-surface shadow-sm transition-transform',
            isDark ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}
