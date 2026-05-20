import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  AuthorClaim,
  AuthorClaimStatus,
} from '@/lib/author-claims-types'

export type { AuthorClaim, AuthorClaimStatus } from '@/lib/author-claims-types'

const COLS =
  'id, user_id, author_name, website_url, contact_email, status, verification_token, created_at, reviewed_at' as const

export async function fetchOwnAuthorClaim(
  userId: string,
): Promise<AuthorClaim | null> {
  const sb = createClient()
  const { data } = await sb
    .from('author_claims')
    .select(COLS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as AuthorClaim | null) ?? null
}

export async function fetchClaimByToken(
  token: string,
): Promise<AuthorClaim | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('author_claims')
    .select(COLS)
    .eq('verification_token', token)
    .maybeSingle()
  return (data as AuthorClaim | null) ?? null
}

export interface PendingClaim extends AuthorClaim {
  profile: {
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

export async function fetchPendingClaims(): Promise<PendingClaim[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('author_claims')
    .select(`${COLS}, profile:user_id(username, display_name, avatar_url)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return (data as unknown as PendingClaim[] | null) ?? []
}

export async function markClaimReviewed(
  claimId: string,
  status: 'verified' | 'rejected',
): Promise<AuthorClaim | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('author_claims')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', claimId)
    .select(COLS)
    .single()
  if (error || !data) return null
  return data as AuthorClaim
}

export async function setProfileVerifiedAuthor(
  userId: string,
  isVerified: boolean,
): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({ is_verified_author: isVerified })
    .eq('id', userId)
}

export async function fetchVerifiedAuthorByName(
  authorName: string,
): Promise<{ username: string; display_name: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('author_claims')
    .select(
      'profile:user_id(username, display_name, is_verified_author)',
    )
    .eq('status', 'verified')
    .ilike('author_name', authorName)
    .limit(1)
    .maybeSingle()
  const row = data as unknown as {
    profile: {
      username: string
      display_name: string
      is_verified_author: boolean | null
    } | null
  } | null
  if (!row?.profile?.is_verified_author) return null
  return {
    username: row.profile.username,
    display_name: row.profile.display_name,
  }
}
