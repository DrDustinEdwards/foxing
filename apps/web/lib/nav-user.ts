import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface NavUser {
  username: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
  subscription_tier: 'free' | 'plus' | 'patron'
}

/**
 * Resolves the navbar user for the current request. Returns null when
 * the user is signed out, when the profile row is missing, or when the
 * Supabase env vars haven't been configured for this environment.
 *
 * Includes `is_admin` so the nav dropdown can conditionally surface the
 * admin entry without an extra round trip.
 */
export async function getNavUser(): Promise<NavUser | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null
  }
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb
    .from('profiles')
    .select('username, display_name, avatar_url, is_admin, subscription_tier')
    .eq('id', user.id)
    .maybeSingle()
  if (!data) return null
  const row = data as {
    username: string
    display_name: string
    avatar_url: string | null
    is_admin: boolean | null
    subscription_tier: string | null
  }
  const tier: NavUser['subscription_tier'] =
    row.subscription_tier === 'plus' || row.subscription_tier === 'patron'
      ? row.subscription_tier
      : 'free'
  return {
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    is_admin: Boolean(row.is_admin),
    subscription_tier: tier,
  }
}

/**
 * Count of unread notifications for the current user. Returns 0 when
 * the user is signed out or env isn't configured so the badge stays
 * hidden without an extra query in callers.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return 0
  }
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return 0
  const { count } = await sb
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
  return count ?? 0
}

export async function getAuthedUserId(): Promise<string | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null
  }
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user?.id ?? null
}

/**
 * Guard for admin-only server actions. Resolves the current user and
 * confirms `profiles.is_admin` via the user-scoped client (RLS-safe).
 * Throws on either failure so callers can stay one-liners. Returns the
 * admin's user id for callers that need it.
 */
export async function requireAdminUserId(): Promise<string> {
  const userId = await getAuthedUserId()
  if (!userId) throw new Error('Unauthorized')
  const sb = createClient()
  const { data } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  const profile = data as { is_admin: boolean | null } | null
  if (!profile?.is_admin) throw new Error('Forbidden')
  return userId
}
