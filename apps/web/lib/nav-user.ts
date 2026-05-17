import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface NavUser {
  username: string
  display_name: string
  avatar_url: string | null
}

/**
 * Resolves the navbar user for the current request. Returns null when
 * the user is signed out, when the profile row is missing, or when the
 * Supabase env vars haven't been configured for this environment.
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
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()
  return (data as NavUser | null) ?? null
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
