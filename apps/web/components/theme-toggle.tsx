'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  applyTheme,
  resolvedTheme,
  setStoredTheme,
  type ResolvedTheme,
} from '@/lib/theme'
import { saveThemePreference } from '@/app/(app)/settings/theme-actions'

interface ThemeToggleProps {
  className?: string
}

/**
 * Two-state toggle between light and dark. System mode still exists at the
 * data layer (first-load default + the inline script), but it's hidden
 * from the UI because users find a three-way control confusing.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [current, setCurrent] = useState<ResolvedTheme>('light')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setCurrent(resolvedTheme())
    setHydrated(true)
  }, [])

  function handleClick() {
    const next: ResolvedTheme = current === 'light' ? 'dark' : 'light'
    setCurrent(next)
    setStoredTheme(next)
    applyTheme(next)
    void saveThemePreference(next)
  }

  const ariaLabel =
    current === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover',
        className,
      )}
    >
      <span aria-hidden="true" suppressHydrationWarning>
        {hydrated && current === 'dark' ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  )
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.7" y2="6.7" />
      <line x1="17.3" y1="17.3" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.7" y2="17.3" />
      <line x1="17.3" y1="6.7" x2="19.1" y2="4.9" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  )
}
