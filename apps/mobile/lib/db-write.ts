import * as Sentry from '@sentry/react-native'
// Local shape for a Postgres/PostgREST-style error. Supabase was removed; the
// data layer now returns errors from /api/v1, but the fields we report are the
// same. See lib/supabase.ts.
type PostgrestError = {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
}

/**
 * Surface a Supabase mutation error to Sentry instead of swallowing it.
 *
 * supabase-js returns `{ error }` rather than throwing, so a write that fails
 * (RLS, constraint, missing grant) looks like success unless the error is read.
 * Call this with the destructured `error` from any `.insert/.update/.delete/.rpc`
 * whose failure matters. Returns true when an error was reported, so callers can
 * branch without re-reading the error. Mirrors web's lib/db-write.ts.
 */
export function reportWriteError(
  error: PostgrestError | null,
  context: { op: string; table?: string; extra?: Record<string, unknown> },
): error is PostgrestError {
  if (!error) return false
  Sentry.captureException(error, {
    tags: { area: 'db-write', op: context.op, table: context.table ?? 'unknown' },
    extra: { code: error.code, details: error.details, hint: error.hint, ...context.extra },
  })
  return true
}
