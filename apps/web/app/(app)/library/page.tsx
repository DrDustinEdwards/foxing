import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { StarRating } from '@/components/ui/star-rating'
import { fetchLibrary, type LibraryStatus } from '@/lib/user-queries'
import { getAuthedUserId } from '@/lib/nav-user'
import { cn } from '@/lib/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My library · Foxing',
}

const TABS: Array<{ id: LibraryStatus; label: string }> = [
  { id: 'reading', label: 'Reading' },
  { id: 'want_to_read', label: 'Want to Read' },
  { id: 'finished', label: 'Finished' },
  { id: 'paused', label: 'Paused' },
  { id: 'abandoned', label: 'Abandoned' },
]

type SortKey = 'date_added' | 'date_finished' | 'title' | 'author' | 'rating'

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'date_added', label: 'Date added' },
  { id: 'date_finished', label: 'Date finished' },
  { id: 'title', label: 'Title' },
  { id: 'author', label: 'Author' },
  { id: 'rating', label: 'Rating' },
]

function compareEntries(
  a: Awaited<ReturnType<typeof fetchLibrary>>[number],
  b: Awaited<ReturnType<typeof fetchLibrary>>[number],
  sort: SortKey,
): number {
  switch (sort) {
    case 'title':
      return a.book.title.localeCompare(b.book.title)
    case 'author':
      return a.book.author.localeCompare(b.book.author)
    case 'date_finished': {
      const ta = a.finished_at ? new Date(a.finished_at).getTime() : 0
      const tb = b.finished_at ? new Date(b.finished_at).getTime() : 0
      return tb - ta
    }
    case 'rating':
      return (b.rating ?? -1) - (a.rating ?? -1)
    case 'date_added':
    default:
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
  }
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { status?: LibraryStatus; sort?: SortKey }
}) {
  const userId = await getAuthedUserId()
  if (!userId) redirect('/sign-in')
  const status = TABS.find((t) => t.id === searchParams.status)?.id ?? 'reading'
  const sort = SORTS.find((s) => s.id === searchParams.sort)?.id ?? 'date_added'
  const items = (await fetchLibrary(userId, status)).sort((a, b) =>
    compareEntries(a, b, sort),
  )

  return (
    <PageWrapper className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-fraunces text-[2rem] text-text-primary">
          My library
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/library" method="get" className="flex items-center gap-2">
            <input type="hidden" name="status" value={status} />
            <label className="flex items-center gap-2 font-dm-sans text-xs text-text-tertiary">
              Sort
              <select
                name="sort"
                defaultValue={sort}
                className="h-9 rounded-md border border-border-interactive bg-bg-surface px-2 font-dm-sans text-sm text-text-primary"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="ghost" size="sm">
              Apply
            </Button>
          </form>
          <Link href="/library/import">
            <Button variant="secondary" size="sm">
              Import
            </Button>
          </Link>
          <Link href="/api/library/export" prefetch={false}>
            <Button variant="secondary" size="sm">
              Export CSV
            </Button>
          </Link>
        </div>
      </div>

      <nav
        aria-label="Library tabs"
        className="mt-6 flex flex-wrap gap-1 border-b border-border-subtle"
      >
        {TABS.map((t) => {
          const params = new URLSearchParams()
          params.set('status', t.id)
          if (sort !== 'date_added') params.set('sort', sort)
          return (
            <Link
              key={t.id}
              href={`/library?${params.toString()}`}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 font-dm-sans text-sm transition-colors',
                status === t.id
                  ? 'border-brand-ui text-text-primary'
                  : 'border-transparent text-text-tertiary hover:text-text-primary',
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            heading={
              status === 'reading'
                ? 'Nothing in progress.'
                : status === 'want_to_read'
                  ? 'Your shelf is empty.'
                  : status === 'finished'
                    ? 'No books finished yet.'
                    : status === 'paused'
                      ? 'No paused books.'
                      : 'No abandoned books.'
            }
            action={
              <Link
                href="/books"
                className="font-dm-sans text-sm text-brand-text hover:underline"
              >
                Find a book
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((entry) => (
            <LibraryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}

function LibraryCard({
  entry,
}: {
  entry: Awaited<ReturnType<typeof fetchLibrary>>[number]
}) {
  const progress = Math.max(
    0,
    Math.min(100, Math.round(entry.progress_percentage ?? 0)),
  )
  return (
    <Link
      href={`/book/${entry.book.slug ?? entry.book.id}`}
      className="group flex flex-col gap-2"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-bg-sunken shadow-sm transition-shadow group-hover:shadow-md">
        {entry.book.cover_url && (
          <Image
            src={entry.book.cover_url}
            alt={entry.book.title}
            fill
            sizes="(max-width: 768px) 45vw, 18vw"
            className="object-cover"
          />
        )}
        {entry.status === 'reading' && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-bg-sunken/70">
            <div
              className="h-full bg-brand-ui"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {entry.status === 'paused' && (
          <Badge variant="warning" className="absolute right-2 top-2">
            Paused
          </Badge>
        )}
        {entry.status === 'abandoned' && (
          <Badge variant="neutral" className="absolute right-2 top-2">
            Set aside
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="truncate font-fraunces text-sm text-text-primary">
          {entry.book.title}
        </p>
        <p className="truncate font-dm-sans text-xs text-text-tertiary">
          {entry.book.author}
        </p>
        {entry.status === 'finished' && typeof entry.rating === 'number' && (
          <StarRating value={entry.rating} size="sm" readOnly />
        )}
      </div>
    </Link>
  )
}
