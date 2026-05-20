import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchClaimByToken } from '@/lib/author-claims'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!params.token) {
    return NextResponse.redirect(new URL('/settings?error=invalid_token', _request.url))
  }
  const claim = await fetchClaimByToken(params.token)
  if (!claim || claim.status === 'rejected') {
    return NextResponse.redirect(
      new URL('/settings?error=invalid_token', _request.url),
    )
  }
  if (claim.status === 'verified') {
    return NextResponse.redirect(
      new URL('/settings?verified=true', _request.url),
    )
  }
  const admin = createAdminClient()
  await admin
    .from('author_claims')
    .update({
      status: 'verified',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', claim.id)
  await admin
    .from('profiles')
    .update({ is_verified_author: true })
    .eq('id', claim.user_id)
  return NextResponse.redirect(
    new URL('/settings?verified=true', _request.url),
  )
}
