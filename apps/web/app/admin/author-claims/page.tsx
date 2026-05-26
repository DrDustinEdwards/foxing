import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchPendingClaims } from '@/lib/author-claims'
import { ClaimReviewButtons } from './claim-review-buttons'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Author claims · Admin',
  robots: { index: false, follow: false },
}

export default async function AuthorClaimsPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const sb = await createClient()
  const { data } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (!(data as { is_admin: boolean | null } | null)?.is_admin) {
    redirect('/')
  }
  const claims = await fetchPendingClaims()

  return (
    <PageWrapper className="py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Author claims
      </h1>
      <p className="mt-2 font-source-serif-4 text-base text-text-secondary">
        Review pending claims and verify the email domain matches the author
        website before approving.
      </p>
      <section className="mt-8">
        {claims.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            No pending claims.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={c.profile?.avatar_url ?? null}
                    name={c.profile?.display_name ?? c.author_name}
                    size="md"
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-fraunces text-base text-text-primary">
                        {c.author_name}
                      </p>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    {c.profile && (
                      <p className="font-dm-sans text-xs text-text-tertiary">
                        @{c.profile.username} · {c.profile.display_name}
                      </p>
                    )}
                    <p className="font-dm-mono text-xs text-text-tertiary">
                      {c.contact_email}
                    </p>
                    {c.website_url && (
                      <a
                        href={c.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-dm-sans text-sm text-brand-text hover:underline"
                      >
                        {c.website_url}
                      </a>
                    )}
                  </div>
                </div>
                <ClaimReviewButtons claimId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWrapper>
  )
}
