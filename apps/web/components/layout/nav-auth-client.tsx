'use client'

import { useEffect, useState } from 'react'
import { Nav } from './nav'
import { createClient } from '@/lib/supabase/client'

interface NavUser {
  username: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
  subscription_tier: 'free' | 'plus' | 'patron'
}

interface NavData {
  user: NavUser | null
  unread: number
}

// Reads the session from the browser Supabase client (localStorage) and
// hydrates the nav with the signed-in state. The server-rendered HTML
// always shows the signed-out nav so public pages can be fully cached
// at the edge without ever calling cookies() on the server.
export function NavAuthClient() {
  const [data, setData] = useState<NavData>({ user: null, unread: 0 })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function refresh() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) {
        setData({ user: null, unread: 0 })
        return
      }
      try {
        const res = await fetch('/api/nav-user', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const payload = (await res.json()) as NavData
        if (!cancelled) setData(payload)
      } catch {
        // Network error: keep the signed-out fallback.
      }
    }

    void refresh()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return <Nav user={data.user} unreadNotifications={data.unread} />
}
