import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getAuthedUserId } from '@/lib/nav-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { JoinViaInviteButton } from './join-via-invite-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Join club · Foxing',
  robots: { index: false, follow: false },
}

// Invite redemption landing. The club is resolved with the admin client so the
// page works for private/secret clubs too (those 404 on the public club page).
// The actual write is gated behind a button click -> redeemClubInvite, so link
// prefetching never joins anyone.
export default async function ClubJoinPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ code?: string }>
}) {
  const [{ slug }, { code }] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const userId = await getAuthedUserId()
  if (!userId) {
    const next = `/clubs/${slug}/join${
      code ? `?code=${encodeURIComponent(code)}` : ''
    }`
    redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }

  const admin = createAdminClient()
  const { data: clubRow } = await admin
    .from('clubs')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()
  const club = clubRow as
    | { id: string; name: string; slug: string | null }
    | null
  if (!club) notFound()

  let state: 'valid' | 'missing' | 'invalid' | 'expired' = 'missing'
  if (code) {
    const { data: inviteRow } = await admin
      .from('club_invites')
      .select('club_id, status, expires_at')
      .eq('invite_code', code)
      .maybeSingle()
    const invite = inviteRow as
      | { club_id: string; status: string | null; expires_at: string | null }
      | null
    if (!invite || invite.club_id !== club.id || invite.status !== 'pending') {
      state = 'invalid'
    } else if (
      invite.expires_at &&
      new Date(invite.expires_at) < new Date()
    ) {
      state = 'expired'
    } else {
      state = 'valid'
    }
  }

  const message: Record<typeof state, string> = {
    valid: `You have been invited to join ${club.name}.`,
    missing: 'This link is missing an invite code.',
    invalid: 'This invite is no longer valid.',
    expired: 'This invite has expired. Ask an organizer for a new link.',
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-16">
          <div className="mx-auto flex max-w-md flex-col gap-5">
            <h1 className="font-fraunces text-[1.75rem] text-text-primary">
              {club.name}
            </h1>
            <p className="font-source-serif-4 text-base text-text-secondary">
              {message[state]}
            </p>
            {state === 'valid' && code ? (
              <JoinViaInviteButton
                clubId={club.id}
                clubSlug={club.slug ?? slug}
                code={code}
              />
            ) : (
              <Link href={`/clubs/${club.slug ?? slug}`}>
                <Button type="button" variant="secondary" size="md">
                  Go to club
                </Button>
              </Link>
            )}
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
