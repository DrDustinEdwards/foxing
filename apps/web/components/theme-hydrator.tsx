'use client'

import { useEffect } from 'react'
import { applyTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

interface Props {
  /**
   * The visitor's saved theme preference, fetched from
   * profile.theme_preference on the server. null means no preference is
   * stored on the server side yet (typical for fresh accounts).
   */
  serverTheme: Theme | null
}

/**
 * When a signed-in user lands on a device that has no theme stored in
 * localStorage, mirror their server-side preference down so this device
 * looks the same as their other devices. localStorage stays the
 * source of truth after that, so manual changes on this device aren't
 * overridden by stale server values.
 */
export function ThemeHydrator({ serverTheme }: Props) {
  useEffect(() => {
    if (!serverTheme) return
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (stored) return
      window.localStorage.setItem(THEME_STORAGE_KEY, serverTheme)
      applyTheme(serverTheme)
    } catch {
      // localStorage can throw in some embedded contexts. Ignore.
    }
  }, [serverTheme])
  return null
}
