export const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/

export function validateUsernameFormat(
  raw: string,
): { ok: true } | { ok: false; reason: string } {
  if (raw.length < 3)
    return { ok: false, reason: 'Username must be at least 3 characters.' }
  if (raw.length > 30)
    return { ok: false, reason: 'Username must be 30 characters or fewer.' }
  if (!USERNAME_RE.test(raw)) {
    return {
      ok: false,
      reason:
        'Use letters, numbers, underscores, or hyphens. Cannot start or end with _ or -.',
    }
  }
  return { ok: true }
}
