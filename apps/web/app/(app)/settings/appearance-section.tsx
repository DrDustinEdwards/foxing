'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { getStoredTheme, setStoredTheme, type Theme } from '@/lib/theme'
import { saveThemePreference } from './theme-actions'

const OPTIONS: Array<{ value: Theme; label: string; description: string }> = [
  {
    value: 'light',
    label: 'Light',
    description: 'Cream backgrounds, charcoal text.',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Charcoal backgrounds, warm white text.',
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follows your operating system.',
  },
]

interface Props {
  initial?: Theme
}

export function AppearanceSection({ initial }: Props) {
  const [theme, setTheme] = useState<Theme>(initial ?? 'system')

  useEffect(() => {
    // localStorage wins over the server-provided initial value because the
    // visitor may have changed it on this device since their last login.
    setTheme(getStoredTheme())
  }, [])

  function handleSelect(value: Theme) {
    setTheme(value)
    setStoredTheme(value)
    void saveThemePreference(value)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((opt) => {
        const active = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value)}
            aria-pressed={active}
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
              active
                ? 'border-brand-ui bg-brand-subtle'
                : 'border-border-default bg-bg-surface hover:bg-bg-hover',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                active ? 'text-brand-text' : 'text-text-tertiary',
              )}
            >
              <OptionIcon value={opt.value} />
            </span>
            <span
              className={cn(
                'font-dm-sans text-sm font-medium',
                active ? 'text-brand-subtle-text' : 'text-text-primary',
              )}
            >
              {opt.label}
            </span>
            <span
              className={cn(
                'font-dm-sans text-xs',
                active ? 'text-brand-subtle-text/80' : 'text-text-tertiary',
              )}
            >
              {opt.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function OptionIcon({ value }: { value: Theme }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (value === 'light') {
    return (
      <svg {...common}>
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
  if (value === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
