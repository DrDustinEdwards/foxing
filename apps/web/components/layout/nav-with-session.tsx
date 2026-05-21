import 'server-only'
import { getNavUser, getUnreadNotificationCount } from '@/lib/nav-user'
import { Nav } from './nav'

/**
 * Server component that reads the session (cookies via Supabase) and
 * renders the Nav with that user. Public pages render this inside a
 * <Suspense fallback={<Nav user={null} unreadNotifications={0} />}>
 * boundary so the rest of the page can be statically prerendered
 * (Partial Prerendering opt-in via `experimental_ppr = true`).
 *
 * The signed-out fallback Nav matches the chrome of the real Nav, so
 * the visible swap on stream-in is just the auth widget on the right.
 */
export async function NavWithSession() {
  const [user, unread] = await Promise.all([
    getNavUser(),
    getUnreadNotificationCount(),
  ])
  return <Nav user={user} unreadNotifications={unread} />
}
