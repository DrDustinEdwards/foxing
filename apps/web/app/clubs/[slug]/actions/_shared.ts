import 'server-only'
import { getClubRole, isClubMod } from '@/lib/club-membership'
import { getAuthedUserId } from '@/lib/nav-user'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function assertMod(clubId: string): Promise<
  | {
      ok: true
      actorId: string
      role: NonNullable<Awaited<ReturnType<typeof getClubRole>>>
    }
  | { ok: false; error: string }
> {
  const actorId = await getAuthedUserId()
  if (!actorId) return { ok: false, error: 'Sign in required.' }
  const role = await getClubRole(clubId, actorId)
  if (!isClubMod(role)) return { ok: false, error: 'Moderator access required.' }
  return { ok: true, actorId, role: role! }
}
