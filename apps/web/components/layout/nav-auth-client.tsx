'use client'

import { Nav } from './nav'
import { useSession } from '@/components/providers/session-provider'

// Reads the session and profile from the SessionProvider context so that
// client-side navigation between pages does not re-trigger an async
// session check. The server-rendered HTML always shows the signed-out
// nav so public pages can be fully cached at the edge.
export function NavAuthClient() {
  const { user, profile, isLoading } = useSession()

  if (isLoading || !user || !profile) {
    return <Nav user={null} unreadNotifications={0} />
  }

  const tier: 'free' | 'plus' =
    profile.subscription_tier === 'plus' ? 'plus' : 'free'

  return (
    <Nav
      user={{
        username: profile.username,
        display_name: profile.display_name ?? profile.username,
        avatar_url: profile.avatar_url,
        is_admin: profile.is_admin,
        subscription_tier: tier,
      }}
      unreadNotifications={profile.unread_count}
    />
  )
}
