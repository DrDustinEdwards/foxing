/**
 * Query-construction helpers shared by every adapter. Centralized so the
 * regression tests assert escaping + cursor math in one place.
 */

/**
 * Escape a user string for safe use inside a PostgREST `ilike` pattern.
 * `%` and `_` are LIKE wildcards; `\` escapes them. We also strip the PostgREST
 * `or()` reserved characters `,` `(` `)` which would otherwise let a query
 * string break out of its filter group.
 */
export function escapeLike(input: string): string {
  return input
    .replace(/[\\%_]/g, '\\$&')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build a `%term%` ilike pattern from raw user input. */
export function likePattern(input: string): string {
  return `%${escapeLike(input)}%`
}

// ── Cursor ────────────────────────────────────────────────────────────────
// Opaque, offset-based cursor. Offset keeps the federated layer simple and
// uniform across entities with different sort columns; the value is opaque to
// consumers so we can switch to keyset pagination later without an API change.

interface CursorPayload {
  o: number
}

export function encodeCursor(offset: number): string {
  const json = JSON.stringify({ o: offset } satisfies CursorPayload)
  // base64url, environment-agnostic (Node Buffer or browser btoa).
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf8').toString('base64url')
  }
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode a cursor to an offset. Invalid/empty cursors decode to offset 0. */
export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  try {
    let json: string
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(cursor, 'base64url').toString('utf8')
    } else {
      const b64 = cursor.replace(/-/g, '+').replace(/_/g, '/')
      json = atob(b64)
    }
    const parsed = JSON.parse(json) as Partial<CursorPayload>
    const offset = Number(parsed.o)
    return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0
  } catch {
    return 0
  }
}
