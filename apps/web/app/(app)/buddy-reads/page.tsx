import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchUserBuddyReads,
  type BuddyRead,
} from '@/lib/missing-pages-queries'
import { fetchProfileBasics } from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { PLUS_PRICE_MONTHLY_LABEL } from '@/lib/config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Buddy reads · Foxing',
  robots: { index: false, follow: false },
}

export default async function BuddyReadsIndex() {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const [buddyReads, profile] = await Promise.all([
    fetchUserBuddyReads(userId),
    fetchProfileBasics(userId),
  ])
  const isPlus = profile?.subscription_tier === 'plus'
  const active = buddyReads.filter((br) => br.is_active)
  const completed = buddyReads.filter((br) => !br.is_active)

  return (
    <PageWrapper className="py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-fraunces text-[2rem] text-text-primary">
            Buddy reads
          </h1>
          <p className="mt-1 font-source-serif-4 text-base text-text-secondary">
            Read a classic with one other person.
          </p>
        </div>
        {isPlus ? (
          <Link href="/buddy-reads/invite">
            <Button variant="primary" size="sm">
              Start a buddy read
            </Button>
          </Link>
        ) : (
          <Link href="/pricing">
            <Button variant="secondary" size="sm">
              Upgrade to Plus
            </Button>
          </Link>
        )}
      </header>

      {!isPlus && (
        <div className="mt-6 rounded-lg border border-border-subtle bg-brand-subtle p-4">
          <p className="font-dm-sans text-sm text-brand-subtle-text">
            Buddy reads are a Plus feature. {PLUS_PRICE_MONTHLY_LABEL}.{' '}
            <Link href="/pricing" className="text-brand-text hover:underline">
              See pricing.
            </Link>
          </p>
        </div>
      )}

      {buddyReads.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            heading="No buddy reads yet. Invite a friend to read a book together."
            action={
              isPlus ? (
                <Link
                  href="/buddy-reads/invite"
                  className="font-dm-sans text-sm text-brand-text hover:underline"
                >
                  Start a buddy read
                </Link>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          {active.length > 0 && <Section heading="Active" items={active} viewerId={userId} />}
          {completed.length > 0 && (
            <Section heading="Completed" items={completed} viewerId={userId} />
          )}
        </>
      )}
    </PageWrapper>
  )
}

function Section({
  heading,
  items,
  viewerId,
}: {
  heading: string
  items: BuddyRead[]
  viewerId: string
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        {heading}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((br) => (
          <BuddyReadCard key={br.id} br={br} viewerId={viewerId} />
        ))}
      </ul>
    </section>
  )
}

function BuddyReadCard({
  br,
  viewerId,
}: {
  br: BuddyRead
  viewerId: string
}) {
  const partner = br.user1_id === viewerId ? br.user2 : br.user1
  return (
    <li>
      <Card variant="entity" href={`/buddy-reads/${br.id}`} className="p-4">
        <div className="flex gap-4">
          {br.book && (
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-bg-sunken">
              {br.book.cover_url && (
                <Image
                  src={br.book.cover_url}
                  alt={br.book.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              )}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate font-fraunces text-base text-text-primary">
              {br.book?.title ?? 'Buddy read'}
            </p>
            {br.book?.author && (
              <p className="font-dm-sans text-xs text-text-tertiary">
                {br.book.author}
              </p>
            )}
            {partner && (
              <div className="mt-1 flex items-center gap-2">
                <Avatar
                  src={partner.avatar_url}
                  name={partner.display_name}
                  size="sm"
                />
                <span className="font-dm-sans text-sm text-text-secondary">
                  with {partner.display_name}
                </span>
              </div>
            )}
            {br.started_at && (
              <p className="font-dm-mono text-[11px] text-text-tertiary">
                Started {new Date(br.started_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="self-center">
            {br.is_active ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="neutral">Done</Badge>
            )}
          </div>
        </div>
      </Card>
    </li>
  )
}
