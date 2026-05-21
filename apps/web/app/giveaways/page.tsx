import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchActiveGiveaways, type GiveawayKind } from '@/lib/giveaways'
import { getAuthedUserId } from '@/lib/nav-user'
import { cn } from '@/lib/cn'

export const revalidate = 60

const FILTERS: Array<{ id: GiveawayKind | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'digital', label: 'Digital' },
  { id: 'physical', label: 'Physical' },
]

export const metadata: Metadata = {
  title: 'Book giveaways · Foxing',
  description: 'Enter to win books from verified authors on Foxing.',
}

export default async function GiveawaysPage({
  searchParams,
}: {
  searchParams: { kind?: string }
}) {
  const filter = FILTERS.find((f) => f.id === searchParams.kind)?.id ?? 'all'
  const [viewerId] = await Promise.all([
    getAuthedUserId(),
  ])
  const kindFilter = filter === 'all' ? undefined : (filter as GiveawayKind)
  const giveaways = await fetchActiveGiveaways(viewerId, kindFilter)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-2">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              Book giveaways
            </h1>
            <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
              Active giveaways run by verified authors. One entry per reader.
            </p>
          </header>

          <nav
            aria-label="Giveaway filters"
            className="mt-6 flex flex-wrap gap-1 border-b border-border-subtle"
          >
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={f.id === 'all' ? '/giveaways' : `/giveaways?kind=${f.id}`}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 font-dm-sans text-sm transition-colors',
                  filter === f.id
                    ? 'border-brand-ui text-text-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-primary',
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          {giveaways.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No active giveaways right now.
            </p>
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
                    Ends {new Date(g.deadline).toLocaleString('en-US')}
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
