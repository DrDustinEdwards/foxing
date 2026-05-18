'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  applyTheme,
  getStoredTheme,
  nextTheme,
  setStoredTheme,
  themeLabel,
  type Theme,
} from '@/lib/theme'
import { saveThemePreference } from '@/app/(app)/settings/theme-actions'

interface ThemeToggleProps {
  className?: string
}

/**
 * Three-way theme cycle button: Light → Dark → System → Light. Shows the
 * icon for the CURRENT mode; the aria-label and tooltip describe the
 * next state so the click feels predictable.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('system')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setTheme(getStoredTheme())
    setHydrated(true)
  }, [])

  // When the choice is 'system', a change in the OS-level preference should
  // flip the rendered theme without requiring a click.
  useEffect(() => {
    if (theme !== 'system') return
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  function handleClick() {
    const next = nextTheme(theme)
    setTheme(next)
    setStoredTheme(next)
    // Best-effort: mirror to profile.theme_preference. The action no-ops
    // when the user is signed out, so we don't gate the call.
    void saveThemePreference(next)
  }

  const nextLabel = themeLabel(nextTheme(theme))
  const ariaLabel = `Switch to ${nextLabel} mode`
  const title = `Theme: ${themeLabel(theme)}. Click for ${nextLabel}.`

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-hover',
        className,
      )}
    >
      <span aria-hidden="true" suppressHydrationWarning>
        <ThemeIcon theme={hydrated ? theme : 'system'} />
      </span>
    </button>
  )
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') return <SunIcon />
  if (theme === 'dark') return <MoonIcon />
  return <MonitorIcon />
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

function MonitorIcon() {
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
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
