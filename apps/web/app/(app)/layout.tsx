import { redirect } from 'next/navigation'
import { type ReactNode } from 'react'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { ThemeHydrator } from '@/components/theme-hydrator'
import { getAuthedUserId, getNavUser, getUnreadNotificationCount } from '@/lib/nav-user'
import { createClient } from '@/lib/supabase/server'
import type { Theme } from '@/lib/theme'

async function getServerTheme(userId: string): Promise<Theme | null> {
  const sb = createClient()
  const { data } = await sb
    .from('profiles')
    .select('theme_preference')
    .eq('id', userId)
    .maybeSingle()
  const value = (data as { theme_preference: string | null } | null)
    ?.theme_preference
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return null
}

/**
 * Layout for all authenticated routes. Middleware already gates these to
 * signed-in users, but we re-fetch the nav user here so child pages don't
 * each need to. Also seeds theme_preference for fresh devices via
 * ThemeHydrator.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const [user, unreadNotifications, serverTheme] = await Promise.all([
    getNavUser(),
    getUnreadNotificationCount(),
    getServerTheme(userId),
  ])
  if (!user) redirect('/sign-in')
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <ThemeHydrator serverTheme={serverTheme} />
      <Nav user={user} unreadNotifications={unreadNotifications} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
