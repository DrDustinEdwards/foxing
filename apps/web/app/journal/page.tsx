import Link from 'next/link'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  getJournalPosts,
  JOURNAL_TAGS,
  type JournalPostSummary,
} from '@/lib/journal'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Journal · Foxing',
  description:
    'Reading guides, author spotlights, and notes on the classics from the Foxing team.',
  alternates: {
    canonical: 'https://foxing.app/journal',
    types: { 'application/rss+xml': 'https://foxing.app/feed.rss' },
  },
  openGraph: {
    title: 'Foxing Journal',
    description:
      'Reading guides, author spotlights, and notes on the classics.',
    url: 'https://foxing.app/journal',
  },
}

const TAG_SLUGS = new Set<string>(JOURNAL_TAGS.map((t) => t.slug))

export default async function JournalIndexPage(
  props: {
    searchParams?: Promise<{ tag?: string | string[] }>
  }
) {
  const searchParams = await props.searchParams;
  const rawTag = Array.isArray(searchParams?.tag)
    ? searchParams?.tag[0]
    : searchParams?.tag
  const activeTag = rawTag && TAG_SLUGS.has(rawTag) ? rawTag : null

  const allPosts = await getJournalPosts()
  const posts = activeTag
    ? allPosts.filter((p) => p.tags.includes(activeTag))
    : allPosts

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-12">
          <header className="max-w-prose">
            <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
              Journal
            </h1>
            <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
              Notes on the books, the reading habit, and what holds up.
            </p>
            <p className="mt-2 font-dm-sans text-xs text-text-tertiary">
              <Link
                href="/feed.rss"
                className="text-brand-text hover:underline"
              >
                RSS feed
              </Link>
            </p>
          </header>

          {allPosts.length === 0 ? (
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
                <PostList posts={posts} />
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
    'rounded-full px-3 py-1 font-dm-sans text-xs border transition-colors no-underline'
  const activeCls = 'bg-brand-subtle text-brand-subtle-text border-brand-ui'
  const inactiveCls =
    'bg-bg-surface text-text-secondary border-border-subtle hover:border-border-default hover:text-text-primary'
  return (
    <nav className="mt-8 flex flex-wrap gap-2">
      <Link
        href="/journal"
        className={`${base} ${active === null ? activeCls : inactiveCls}`}
      >
        All
      </Link>
      {JOURNAL_TAGS.map((t) => (
        <Link
          key={t.slug}
          href={`/journal?tag=${t.slug}`}
          className={`${base} ${active === t.slug ? activeCls : inactiveCls}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

function PostList({ posts }: { posts: JournalPostSummary[] }) {
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
                {post.tags[0].replace(/-/g, ' ')}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
