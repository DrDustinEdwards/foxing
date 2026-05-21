'use client'

import { useEffect } from 'react'

/**
 * Fires a single POST to /api/log-404 with the current path and
 * document.referrer when the global not-found page mounts. Best
 * effort: failures are swallowed so the user still sees the 404
 * page even if the log endpoint is down.
 */
export function NotFoundLogger() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const path = window.location.pathname
    if (!path) return
    fetch('/api/log-404', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {})
  }, [])
  return null
}
