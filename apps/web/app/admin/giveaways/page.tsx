import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserId } from '@/lib/nav-user'
import { fetchEndedGiveawaysForAdmin } from '@/lib/giveaways'
import { PickWinnersButton } from './pick-winners-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Giveaways · Admin',
  robots: { index: false, follow: false },
}

export default async function AdminGiveawaysPage() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const sb = createClient()
  const { data } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (!(data as { is_admin: boolean | null } | null)?.is_admin) {
    redirect('/')
  }
  const giveaways = await fetchEndedGiveawaysForAdmin()

  return (
    <PageWrapper className="py-10">
      <h1 className="font-fraunces text-[2rem] text-text-primary">
        Giveaways awaiting winners
      </h1>
      <p className="mt-2 font-source-serif-4 text-base text-text-secondary">
        Pick winners for giveaways past their deadline.
      </p>
      <section className="mt-8">
        {giveaways.length === 0 ? (
          <p className="font-source-serif-4 text-base text-text-tertiary">
            No giveaways waiting.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {giveaways.map((g) => (
              <li
                key={g.id}
                className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/giveaways/${g.id}`}
                    className="font-fraunces text-base text-text-primary hover:text-brand-text"
                  >
                    {g.title}
                  </Link>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    {g.entry_count} entries · {g.prize_count} winners
                  </span>
                  <Badge
                    variant={g.kind === 'digital' ? 'info' : 'brand'}
                    className="w-fit"
                  >
                    {g.kind}
                  </Badge>
                </div>
                <PickWinnersButton giveawayId={g.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWrapper>
  )
}
