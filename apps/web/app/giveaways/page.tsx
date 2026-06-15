import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PageHeader } from '@/components/ui/page-header'
import { FilterBar } from '@/components/search/filter-bar'
import { GIVEAWAYS_FILTER_CONFIG } from '@/lib/search/configs'
import {
  fetchActiveGiveaways,
  fetchEndedGiveaways,
  type GiveawayKind,
} from '@/lib/giveaways'
import { buildGiveawaysMetadata } from '@/lib/metadata'
import { getAuthedUserId } from '@/lib/nav-user'

export const revalidate = 60

export const metadata: Metadata = buildGiveawaysMetadata()

// /giveaways is NOT a federated search entity (see GIVEAWAYS_FILTER_CONFIG). It
// reuses the shared FilterBar UI primitive for URL-synced type/status facets but
// runs its OWN query -- giveaways are transactional, not catalog content, and
// must not enter the universal search palette. Do not migrate this to
// searchPageData; there is deliberately no giveaway adapter.

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function GiveawaysPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const kindRaw = firstParam(searchParams.kind)
  const kind: GiveawayKind | undefined =
    kindRaw === 'digital' || kindRaw === 'physical' ? kindRaw : undefined
  const ended = firstParam(searchParams.status) === 'ended'

  const viewerId = await getAuthedUserId()
  const giveaways = ended
    ? await fetchEndedGiveaways(viewerId, kind)
    : await fetchActiveGiveaways(viewerId, kind)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <PageHeader
            title="Book giveaways"
            subtitle="Active giveaways run by verified authors. One entry per reader."
            subtitleVariant="description"
          />

          <div className="mt-6">
            <FilterBar config={GIVEAWAYS_FILTER_CONFIG} />
          </div>

          {giveaways.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                heading={
                  ended
                    ? 'No ended giveaways match those filters.'
                    : 'No active giveaways right now.'
                }
                action={
                  <Link
                    href="/giveaways"
                    className="font-dm-sans text-sm text-brand-text hover:underline"
                  >
                    See active giveaways
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {giveaways.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
                >
                  <div className="flex gap-3">
                    {g.book?.cover_url && (
                      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-bg-sunken">
                        <Image
                          src={g.book.cover_url}
                          alt={g.book.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-1">
                      <Link
                        href={`/giveaways/${g.id}`}
                        className="font-fraunces text-base text-text-primary hover:text-brand-text"
                      >
                        {g.title}
                      </Link>
                      {g.book && (
                        <p className="font-dm-sans text-sm text-text-tertiary">
                          {g.book.title} by {g.book.author}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant={g.kind === 'digital' ? 'info' : 'brand'}>
                          {g.kind}
                        </Badge>
                        <span className="font-dm-mono text-xs text-text-tertiary">
                          {g.entry_count} entries · {g.prize_count} winner
                          {g.prize_count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="font-dm-mono text-xs text-text-tertiary">
                    {ended ? 'Ended ' : 'Ends '}
                    {new Date(g.deadline).toLocaleString('en-US')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
