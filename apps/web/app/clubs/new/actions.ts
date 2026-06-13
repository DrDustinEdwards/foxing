'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import { reportWriteError } from '@/lib/db-write'
import { slugify } from '@/lib/slug'
import { checkAndAwardBadges } from '@/lib/badges'

// A club slug must be unique for /clubs/[slug] routing. slugify(name) matches
// the shared slug rule; append -2, -3, ... on collision.
async function uniqueClubSlug(
  admin: ReturnType<typeof createAdminClient>,
  name: string,
): Promise<string> {
  const base = slugify(name) || 'club'
  const { data } = await admin
    .from('clubs')
    .select('slug')
    .like('slug', `${base}%`)
  const taken = new Set(
    ((data as { slug: string | null }[] | null) ?? [])
      .map((r) => r.slug)
      .filter((s): s is string => !!s),
  )
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// Create a club: a standing community (no book) or a single-book club
// (book chosen now -> current_book_id). The creator becomes an admin, the
// highest club role (the club_members_role_check CHECK allows only
// admin/moderator/member; there is no 'owner' role).
//
// Failures are RETURNED, not thrown: a thrown Server Action error reaches the
// client only as a redacted generic digest in production, so the form could
// never show a real message. Success still redirects.
type CreateClubResult = { ok: false; error: string }

export async function createClub(
  formData: FormData,
): Promise<CreateClubResult | void> {
  const name = String(formData.get('name') ?? '').trim().slice(0, 120)
  const description =
    String(formData.get('description') ?? '').trim().slice(0, 2000) || null
  const bookId = String(formData.get('book_id') ?? '').trim() || null
  const visibility =
    String(formData.get('visibility') ?? 'public').trim() === 'private'
      ? 'private'
      : 'public'
  // Match the vocabulary the web club reader + settings panel use
  // (relaxed/moderate/intensive); default moderate.
  const paceRaw = String(formData.get('reading_pace') ?? 'moderate').trim()
  const reading_pace = ['relaxed', 'moderate', 'intensive'].includes(paceRaw)
    ? paceRaw
    : 'moderate'

  if (!name) return { ok: false, error: 'A club name is required.' }

  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }

  const admin = createAdminClient()
  const slug = await uniqueClubSlug(admin, name)

  const { data: club, error: clubErr } = await admin
    .from('clubs')
    .insert({
      name,
      description,
      current_book_id: bookId,
      creator_id: userId,
      visibility,
      reading_pace,
      slug,
    })
    .select('id, slug')
    .single()
  if (reportWriteError(clubErr, { op: 'insert', table: 'clubs' }) || !club) {
    return { ok: false, error: clubErr?.message ?? 'Could not create the club.' }
  }

  const newClub = club as { id: string; slug: string }

  // The creator's admin membership. If this fails, roll back the club so we
  // never leave one without an admin (member_count default 1 assumes it).
  const { error: memErr } = await admin.from('club_members').insert({
    club_id: newClub.id,
    user_id: userId,
    role: 'admin',
    status: 'active',
  })
  if (reportWriteError(memErr, { op: 'insert', table: 'club_members' })) {
    await admin.from('clubs').delete().eq('id', newClub.id)
    return { ok: false, error: memErr?.message ?? 'Could not add you to the club.' }
  }

  await checkAndAwardBadges(userId)
  revalidatePath('/clubs')
  redirect(`/clubs/${newClub.slug}`)
}
