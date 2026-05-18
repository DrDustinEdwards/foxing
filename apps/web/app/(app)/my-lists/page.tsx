import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchFeaturedLists,
  fetchUserLists,
  type UserList,
} from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { cn } from '@/lib/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My lists · Foxing',
}

const TABS = [
  { id: 'mine', label: 'My lists' },
  { id: 'featured', label: 'Featured' },
] as const
type TabId = (typeof TABS)[number]['id']

export default async function ListsPage({
  searchParams,
}: {
  searchParams: { tab?: TabId }
}) {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const tab: TabId = TABS.find((t) => t.id === searchParams.tab)?.id ?? 'mine'
  const items =
    tab === 'mine' ? await fetchUserLists(userId) : await fetchFeaturedLists()

  return (
    <PageWrapper className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-fraunces text-[2rem] text-text-primary">
          Lists
        </h1>
        <Link href="/my-lists/new">
          <Button variant="primary" size="sm">
            Create a list
          </Button>
        </Link>
      </div>

      <nav
        aria-label="Lists tabs"
        className="mt-6 flex flex-wrap gap-1 border-b border-border-subtle"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/my-lists?tab=${t.id}`}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 font-dm-sans text-sm transition-colors',
              tab === t.id
                ? 'border-brand-ui text-text-primary'
                : 'border-transparent text-text-tertiary hover:text-text-primary',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            heading={
              tab === 'mine'
                ? 'You haven’t made a list yet.'
                : 'No featured lists yet.'
            }
            action={
              tab === 'mine' ? (
                <Link href="/my-lists/new">
                  <Button variant="primary" size="sm">
                    Create your first list
                  </Button>
                </Link>
              ) : (
                <Link
                  href="/books"
                  className="font-dm-sans text-sm text-brand-text hover:underline"
                >
                  Browse books
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => (
            <ListSummaryCard key={l.id} list={l} />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}

function ListSummaryCard({ list }: { list: UserList }) {
  return (
    <Link
      href={`/my-lists/${list.id}`}
      className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4 transition-shadow hover:shadow-md"
    >
      <h2 className="font-fraunces text-base text-text-primary">{list.title}</h2>
      {list.description && (
        <p className="line-clamp-2 font-dm-sans text-sm text-text-secondary">
          {list.description}
        </p>
      )}
      <p className="font-dm-mono text-xs text-text-tertiary">
        {list.book_count} books{list.is_public ? ' · public' : ' · private'}
      </p>
    </Link>
  )
}
