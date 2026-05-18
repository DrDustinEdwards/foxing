'use server'

import { createClient } from '@/lib/supabase/server'

const VALID: readonly string[] = ['light', 'dark', 'system']

/**
 * Persists the visitor's theme preference to profile.theme_preference
 * when they're signed in. Silently no-ops when signed out so the
 * client doesn't need to gate the call. localStorage remains the
 * authoritative source for instant load.
 */
export async function saveThemePreference(theme: string): Promise<void> {
  if (!VALID.includes(theme)) return
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return
  }
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return
  await sb
    .from('profiles')
    .update({ theme_preference: theme })
    .eq('id', user.id)
}
