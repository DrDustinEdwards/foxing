import Link from 'next/link'
import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  estimateReadingTime,
  getFeaturedJournalPost,
  getJournalPost,
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

export default async function JournalIndexPage() {
  const [allPosts, featuredSummary] = await Promise.all([
    getJournalPosts(),
    getFeaturedJournalPost(),
  ])

  // Need the full body for the featured post so we can compute reading time.
  const featured = featuredSummary
    ? await getJournalPost(featuredSummary.slug)
    : null

  const remaining = featured
    ? allPosts.filter((p) => p.slug !== featured.slug)
    : allPosts
  const latest = remaining.slice(0, 4)

  if (allPosts.length === 0) {
    return (
      <PageShell>
        <JournalHeader />
        <div className="mt-12">
          <EmptyState heading="No posts yet." />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <JournalHeader />
      {featured && <FeaturedHero post={featured} />}
      {JOURNAL_TAGS.map((tag) => {
        const posts = remaining
          .filter((p) => p.tags.includes(tag.slug))
          .slice(0, 4)
        if (posts.length === 0) return null
        return <CategorySection key={tag.slug} tag={tag} posts={posts} />
      })}
      {latest.length > 0 && <LatestSection posts={latest} />}
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-12">{children}</PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function JournalHeader() {
  return (
    <header className="flex flex-col gap-3">
      <div className="max-w-prose">
        <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary">
          Journal
        </h1>
        <p className="mt-3 font-source-serif-4 text-base text-text-secondary">
          Notes on the books, the reading habit, and what holds up.
        </p>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 font-dm-sans text-xs text-text-tertiary">
        <Link
          href="/journal/archive"
          className="text-brand-text hover:underline"
        >
          All articles →
        </Link>
        <Link href="/feed.rss" className="text-brand-text hover:underline">
          RSS feed
        </Link>
      </p>
    </header>
  )
}

function FeaturedHero({
  post,
}: {
  post: Awaited<ReturnType<typeof getJournalPost>>
}) {
  if (!post) return null
  const minutes = estimateReadingTime(post.content)
  const primaryTag = post.tags[0]
  const tagLabel = primaryTag
    ? (JOURNAL_TAGS.find((t) => t.slug === primaryTag)?.label ??
      primaryTag.replace(/-/g, ' '))
    : null

  return (
    <section className="mt-10 grid gap-8 rounded-xl border border-border-subtle bg-bg-surface p-6 md:grid-cols-[1.2fr_1fr] md:items-center md:gap-12 md:p-10">
      <div className="flex flex-col gap-4">
        {tagLabel && (
          <span className="self-start rounded-full bg-brand-subtle px-3 py-1 font-dm-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brand-subtle-text">
            {tagLabel}
          </span>
        )}
        <h2 className="font-fraunces text-[2rem] leading-tight text-text-primary md:text-[2.25rem]">
          <Link
            href={`/journal/${post.slug}`}
            className="no-underline hover:text-brand-text"
          >
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className="font-source-serif-4 text-base leading-relaxed text-text-secondary line-clamp-3">
            {post.excerpt}
          </p>
        )}
        <p className="font-dm-mono text-xs text-text-tertiary">
          {minutes} min read
        </p>
        <div>
          <Link
            href={`/journal/${post.slug}`}
            className="inline-flex items-center rounded-md bg-brand-ui px-4 py-2 font-dm-sans text-sm text-text-on-brand no-underline transition-colors hover:bg-brand-hover"
          >
            Read the article →
          </Link>
        </div>
      </div>
      <FeaturedIllustration />
    </section>
  )
}

function FeaturedIllustration() {
  return (
    <div className="flex aspect-[5/4] w-full items-center justify-center">
      <svg
        viewBox="0 0 320 256"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        aria-hidden="true"
        role="presentation"
      >
        <defs>
          <linearGradient id="fox-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#D4622E" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <circle cx="232" cy="76" r="48" fill="url(#fox-glow)" opacity="0.55" />
        <rect
          x="36"
          y="56"
          width="200"
          height="148"
          rx="10"
          fill="#FAE0D6"
          stroke="#D4622E"
          strokeWidth="2"
        />
        <rect
          x="56"
          y="76"
          width="200"
          height="148"
          rx="10"
          fill="#FFFFFF"
          stroke="#8A3610"
          strokeWidth="2"
        />
        <line
          x1="80"
          y1="108"
          x2="220"
          y2="108"
          stroke="#D4622E"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="80"
          y1="132"
          x2="200"
          y2="132"
          stroke="#815E41"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <line
          x1="80"
          y1="152"
          x2="216"
          y2="152"
          stroke="#815E41"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <line
          x1="80"
          y1="172"
          x2="188"
          y2="172"
          stroke="#815E41"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <line
          x1="80"
          y1="192"
          x2="208"
          y2="192"
          stroke="#815E41"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    </div>
  )
}

function CategorySection({
  tag,
  posts,
}: {
  tag: (typeof JOURNAL_TAGS)[number]
  posts: JournalPostSummary[]
}) {
  return (
    <section className="mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-brand-text">
            {tag.label}
          </p>
          <p className="font-source-serif-4 text-sm text-text-secondary">
            {tag.description}
          </p>
        </div>
        <Link
          href={`/journal/tag/${tag.slug}`}
          className="shrink-0 font-dm-mono text-[0.6875rem] uppercase tracking-[0.08em] text-text-tertiary no-underline transition-colors hover:text-text-primary"
        >
          See all →
        </Link>
      </div>
      <PostCardGrid posts={posts} />
    </section>
  )
}

function LatestSection({ posts }: { posts: JournalPostSummary[] }) {
  return (
    <section className="mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-brand-text">
          Latest
        </p>
        <Link
          href="/journal/archive"
          className="shrink-0 font-dm-mono text-[0.6875rem] uppercase tracking-[0.08em] text-text-tertiary no-underline transition-colors hover:text-text-primary"
        >
          All articles →
        </Link>
      </div>
      <PostCardGrid posts={posts} />
    </section>
  )
}

function PostCardGrid({ posts }: { posts: JournalPostSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

function PostCard({ post }: { post: JournalPostSummary }) {
  const primaryTag = post.tags[0]
  const tagLabel = primaryTag
    ? (JOURNAL_TAGS.find((t) => t.slug === primaryTag)?.label ??
      primaryTag.replace(/-/g, ' '))
    : null
  // No content on summaries, so reading time is approximated from the excerpt.
  // It is a rough hint and we hide it when missing.
  const minutes = post.excerpt ? estimateReadingTime(post.excerpt) : null
  return (
    <Link
      href={`/journal/${post.slug}`}
      className="group flex h-full flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-5 no-underline transition-colors hover:border-brand-ui"
    >
      {tagLabel && (
        <span className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
          {tagLabel}
        </span>
      )}
      <p className="font-fraunces text-base leading-snug text-text-primary line-clamp-2 transition-colors group-hover:text-brand-text">
        {post.title}
      </p>
      {post.excerpt && (
        <p className="flex-1 font-source-serif-4 text-sm text-text-secondary line-clamp-3">
          {post.excerpt}
        </p>
      )}
      {minutes && (
        <p className="mt-1 font-dm-mono text-[0.6875rem] text-text-tertiary">
          {minutes} min read
        </p>
      )}
    </Link>
  )
}
