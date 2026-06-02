import Link from 'next/link'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { getJournalPostsStatic } from '@/lib/journal'
import { JOURNAL_TAGS, type JournalPostSummary } from '@/lib/journal-shared'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'All articles · Foxing Journal',
  description:
    'Every published article from the Foxing Journal, newest first.',
  alternates: { canonical: 'https://foxing.app/journal/archive' },
  openGraph: {
    title: 'All articles · Foxing Journal',
    description: 'Every published article from the Foxing Journal.',
    url: 'https://foxing.app/journal/archive',
  },
}

const TAG_SLUGS = new Set<string>(JOURNAL_TAGS.map((t) => t.slug))

export default async function JournalArchivePage(props: {
  searchParams: Promise<{ tag?: string }>
}) {
  const searchParams = await props.searchParams
  const rawTag = searchParams.tag
  const activeTag = rawTag && TAG_SLUGS.has(rawTag) ? rawTag : null
  const activeLabel = activeTag
    ? (JOURNAL_TAGS.find((t) => t.slug === activeTag)?.label ?? activeTag)
    : null

  const all = await getJournalPostsStatic()
  const posts = activeTag
    ? all.filter((p) => p.tags.includes(activeTag))
    : all
  const count = posts.length
  const countLabel = count === 1 ? 'article' : 'articles'

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <p className="mb-6">
            <Link
              href="/journal"
              className="font-dm-sans text-sm text-text-tertiary no-underline hover:text-text-primary"
            >
              ← Journal
            </Link>
          </p>
          <header className="flex flex-col gap-2">
            <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
              All articles
            </h1>
            <p className="font-dm-mono text-sm text-text-tertiary">
              {count} {countLabel}
              {activeLabel ? ` in ${activeLabel}` : ''}
            </p>
          </header>
          {all.length === 0 ? (
            <div className="mt-12">
              <EmptyState heading="No posts yet." />
            </div>
          ) : (
            <>
              <TagPills active={activeTag} />
              {posts.length === 0 ? (
                <div className="mt-10">
                  <EmptyState heading="No posts in this tag yet." />
                </div>
              ) : (
                <ArchiveList posts={posts} />
              )}
            </>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function TagPills({ active }: { active: string | null }) {
  const base =
    'rounded-full px-3 py-1 font-dm-mono text-xs border transition-colors no-underline'
  const activeCls = 'bg-brand-subtle text-brand-subtle-text border-brand-ui'
  const inactiveCls =
    'bg-bg-surface text-text-secondary border-border-subtle hover:border-border-default hover:text-text-primary'
  return (
    <nav className="mt-8 flex flex-wrap gap-2">
      <Link
        href="/journal/archive"
        className={`${base} ${active === null ? activeCls : inactiveCls}`}
      >
        All
      </Link>
      {JOURNAL_TAGS.map((t) => (
        <Link
          key={t.slug}
          href={`/journal/archive?tag=${t.slug}`}
          className={`${base} ${active === t.slug ? activeCls : inactiveCls}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

function ArchiveList({ posts }: { posts: JournalPostSummary[] }) {
  return (
    <ul className="mt-10 flex flex-col divide-y divide-border-subtle">
      {posts.map((post) => (
        <li key={post.id}>
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
            {post.tags.length > 0 && (
              <span className="shrink-0 font-dm-mono text-[0.6875rem] text-text-tertiary">
                {JOURNAL_TAGS.find((t) => t.slug === post.tags[0])?.label ??
                  post.tags[0].replace(/-/g, ' ')}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
