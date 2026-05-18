import { redirect } from 'next/navigation'
import { type ReactNode } from 'react'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { getNavUser, getUnreadNotificationCount } from '@/lib/nav-user'

/**
 * Layout for all authenticated routes. Middleware already gates these to
 * signed-in users, but we re-fetch the nav user here so child pages don't
 * each need to.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, unreadNotifications] = await Promise.all([
    getNavUser(),
    getUnreadNotificationCount(),
  ])
  if (!user) redirect('/sign-in')
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={user} unreadNotifications={unreadNotifications} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
