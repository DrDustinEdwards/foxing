import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchGiveawayById } from '@/lib/giveaways'
import { getAuthedUserId } from '@/lib/nav-user'
import { EnterGiveawayButton } from './enter-button'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const g = await fetchGiveawayById(params.id, null)
  if (!g) return { title: 'Giveaway not found' }
  return {
    title: `${g.title} · Foxing giveaway`,
    description:
      g.description ?? `Enter the ${g.title} giveaway on Foxing.`,
  }
}

export default async function GiveawayDetailPage(
  props: {
    params: Promise<{ id: string }>
  }
) {
  const params = await props.params;
  const [viewerId] = await Promise.all([
    getAuthedUserId(),
  ])
  const giveaway = await fetchGiveawayById(params.id, viewerId)
  if (!giveaway) notFound()

  const ended =
    Boolean(giveaway.winner_picked_at) ||
    new Date(giveaway.deadline) < new Date()

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <Link
            href="/giveaways"
            className="font-dm-sans text-sm text-brand-text hover:underline"
          >
            ← All giveaways
          </Link>
          <header className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-fraunces text-[2rem] text-text-primary">
                {giveaway.title}
              </h1>
              <Badge variant={giveaway.kind === 'digital' ? 'info' : 'brand'}>
                {giveaway.kind}
              </Badge>
              {ended && <Badge variant="neutral">Ended</Badge>}
            </div>
            {giveaway.author && (
              <p className="font-dm-sans text-sm text-text-tertiary">
                Run by{' '}
                <Link
                  href={`/u/${giveaway.author.username}`}
                  className="hover:underline"
                >
                  {giveaway.author.display_name}
                </Link>
              </p>
            )}
          </header>

          {giveaway.book && (
            <section className="mt-6 flex gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4">
              {giveaway.book.cover_url && (
                <div className="relative h-40 w-28 shrink-0 overflow-hidden rounded bg-bg-sunken">
                  <Image
                    src={giveaway.book.cover_url}
                    alt={giveaway.book.title}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <Link
                  href={`/book/${giveaway.book.slug ?? giveaway.book.id}`}
                  className="font-fraunces text-lg text-text-primary hover:text-brand-text"
                >
                  {giveaway.book.title}
                </Link>
                <p className="font-dm-sans text-sm text-text-tertiary">
                  {giveaway.book.author}
                </p>
              </div>
            </section>
          )}

          {giveaway.description && (
            <section className="mt-6">
              <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
                {giveaway.description}
              </p>
            </section>
          )}

          <section className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4">
            <div className="flex flex-col">
              <span className="font-dm-mono text-[11px] uppercase tracking-wider text-text-tertiary">
                Entries
              </span>
              <span className="font-fraunces text-2xl text-text-primary">
                {giveaway.entry_count}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-dm-mono text-[11px] uppercase tracking-wider text-text-tertiary">
                Winners
              </span>
              <span className="font-fraunces text-2xl text-text-primary">
                {giveaway.prize_count}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-dm-mono text-[11px] uppercase tracking-wider text-text-tertiary">
                {ended ? 'Ended' : 'Ends'}
              </span>
              <span className="font-dm-sans text-base text-text-primary">
                {new Date(giveaway.deadline).toLocaleString('en-US')}
              </span>
            </div>
            <div className="ml-auto">
              <EnterGiveawayButton
                giveawayId={giveaway.id}
                disabled={ended || !viewerId}
                alreadyEntered={giveaway.viewer_entered}
              />
            </div>
          </section>
          {!viewerId && (
            <p className="mt-3 font-dm-sans text-sm text-text-tertiary">
              <Link
                href={`/sign-in?next=/giveaways/${giveaway.id}`}
                className="text-brand-text hover:underline"
              >
                Sign in
              </Link>{' '}
              to enter.
            </p>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
