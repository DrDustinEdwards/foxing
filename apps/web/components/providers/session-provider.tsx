'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  username: string
  display_name: string | null
  avatar_url: string | null
  is_admin: boolean
  subscription_tier: string
  unread_count: number
}

type SessionContextValue = {
  user: User | null
  profile: Profile | null
  isLoading: boolean
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  profile: null,
  isLoading: true,
})

interface NavUserResponse {
  user: {
    username: string
    display_name: string
    avatar_url: string | null
    is_admin: boolean
    subscription_tier: string
  } | null
  unread: number
}

export function SessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function fetchProfile(): Promise<Profile | null> {
      try {
        const res = await fetch('/api/nav-user', { cache: 'no-store' })
        if (!res.ok) return null
        const data = (await res.json()) as NavUserResponse
        if (!data.user) return null
        return {
          username: data.user.username,
          display_name: data.user.display_name,
          avatar_url: data.user.avatar_url,
          is_admin: data.user.is_admin,
          subscription_tier: data.user.subscription_tier,
          unread_count: data.unread,
        }
      } catch {
        return null
      }
    }

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) {
        const p = await fetchProfile()
        if (cancelled) return
        setProfile(p)
      }
      setIsLoading(false)
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null
      if (cancelled) return
      setUser(sessionUser)
      if (sessionUser) {
        const p = await fetchProfile()
        if (cancelled) return
        setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <SessionContext.Provider value={{ user, profile, isLoading }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
