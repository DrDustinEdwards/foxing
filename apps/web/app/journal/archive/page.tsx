import Link from 'next/link'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/empty-state'
import { JournalPageShell } from '@/components/journal/JournalPageShell'
import { FilterBar } from '@/components/search/filter-bar'
import { SearchPagination } from '@/components/search/search-pagination'
import { JOURNAL_FILTER_CONFIG } from '@/lib/search/configs'
import { searchPageData } from '@/lib/search/server'
import { JOURNAL_TAGS } from '@/lib/journal-shared'
import { ArrowLeftIcon } from '@/components/journal/Icons'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'All articles · Foxing Journal',
  description:
    'Every published article from the Foxing Journal, searchable by tag.',
  alternates: { canonical: 'https://foxing.app/journal/archive' },
  openGraph: {
    title: 'All articles · Foxing Journal',
    description: 'Every published article from the Foxing Journal.',
    url: 'https://foxing.app/journal/archive',
  },
}

interface JournalHit {
  slug: string
  title: string
  excerpt: string | null
  tags: string[] | null
}

export default async function JournalArchivePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const { result, page, totalPages, facetCounts } = await searchPageData(
    'journal',
    JOURNAL_FILTER_CONFIG,
    searchParams,
    { pageSize: 30 },
  )
  const posts = result.hits.map((hit) => hit.data as JournalHit)

  const rawTag = Array.isArray(searchParams.tag)
    ? searchParams.tag[0]
    : searchParams.tag
  const activeLabel = rawTag
    ? (JOURNAL_TAGS.find((t) => t.slug === rawTag)?.label ?? null)
    : null
  const countLabel = result.total === 1 ? 'article' : 'articles'

  return (
    <JournalPageShell>
      <p className="mb-6">
        <Link
          href="/journal"
          className="group inline-flex items-center gap-1.5 font-dm-sans text-sm text-text-tertiary no-underline hover:text-text-primary transition-colors"
        >
          <ArrowLeftIcon className="transition-transform group-hover:-translate-x-0.5" />
          Journal
        </Link>
      </p>
      <header className="flex flex-col gap-2">
        <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
          All articles
        </h1>
        <p className="font-dm-mono text-sm text-text-tertiary">
          {result.total} {countLabel}
          {activeLabel ? ` in ${activeLabel}` : ''}
        </p>
      </header>

      <div className="mt-8">
        <FilterBar config={JOURNAL_FILTER_CONFIG} facetCounts={facetCounts} />
      </div>

      {posts.length === 0 ? (
        <div className="mt-10">
          <EmptyState heading="No articles match those filters." />
        </div>
      ) : (
        <>
          <ArchiveList posts={posts} />
          <SearchPagination
            basePath="/journal/archive"
            page={page}
            totalPages={totalPages}
            searchParams={searchParams}
          />
        </>
      )}
    </JournalPageShell>
  )
}

function ArchiveList({ posts }: { posts: JournalHit[] }) {
  return (
    <ul className="mt-10 flex flex-col divide-y divide-border-subtle">
      {posts.map((post) => (
        <li key={post.slug}>
          <Link
            href={`/journal/${post.slug}`}
            className="group flex items-start justify-between gap-4 rounded-lg px-2 -mx-2 py-4 no-underline transition-colors hover:bg-bg-hover"
          >
            <div className="min-w-0 flex-1">
              <p className="font-fraunces text-base leading-snug text-text-primary line-clamp-1 transition-colors group-hover:text-brand-text">
                {post.title}
              </p>
              {post.excerpt && (
                <p className="mt-0.5 font-source-serif-4 text-sm text-text-secondary line-clamp-1">
                  {post.excerpt}
                </p>
              )}
            </div>
            {post.tags && post.tags.length > 0 && (
              <span className="shrink-0 font-dm-mono text-[0.6875rem] text-text-tertiary">
                {JOURNAL_TAGS.find((t) => t.slug === post.tags?.[0])?.label ??
                  post.tags[0].replace(/-/g, ' ')}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
