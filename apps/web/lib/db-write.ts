import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Surface a Supabase mutation error to Sentry instead of swallowing it.
 *
 * supabase-js returns `{ error }` rather than throwing, so a write that fails
 * (RLS, constraint, missing grant) looks like success unless the error is read.
 * Call this with the destructured `error` from any `.insert/.update/.delete/.rpc`
 * whose failure matters. Returns true when an error was reported, so callers can
 * branch without re-reading the error.
 *
 * This does NOT change the write itself; it only makes failures visible. The
 * happy path is unaffected (error is null -> no-op, returns false).
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
