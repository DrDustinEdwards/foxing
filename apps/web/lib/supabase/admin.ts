import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only admin client. Uses the service role key. Never import this
 * from a client component or expose its responses to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
