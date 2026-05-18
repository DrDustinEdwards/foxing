import Image from 'next/image'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchPublishedJournalPosts,
  formatLongDate,
  readingMinutes,
  type JournalPostSummary,
} from '@/lib/journal'
import { getNavUser } from '@/lib/nav-user'
import { STATIC_PAGE_METADATA } from '@/lib/metadata'

export const revalidate = 3600

export const metadata = STATIC_PAGE_METADATA['/journal']

export default async function JournalIndexPage() {
  const [navUser, posts] = await Promise.all([
    getNavUser(),
    fetchPublishedJournalPosts(24),
  ])
  const [hero, ...rest] = posts

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
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

          {posts.length === 0 ? (
            <div className="mt-12">
              <EmptyState heading="No posts yet." />
            </div>
          ) : (
            <>
              {hero && <HeroPost post={hero} />}
              {rest.length > 0 && (
                <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function HeroPost({ post }: { post: JournalPostSummary }) {
  return (
    <article className="mt-10 grid gap-6 rounded-xl border border-border-subtle bg-bg-surface p-5 md:grid-cols-[1fr_1fr] md:items-center md:gap-8 md:p-8">
      <Link
        href={`/journal/${post.slug}`}
        className="relative aspect-[16/10] overflow-hidden rounded-lg bg-bg-sunken"
      >
        {post.cover_image_url ? (
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-tertiary" />
        )}
      </Link>
      <div className="flex flex-col gap-3">
        <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
          Latest
        </p>
        <h2 className="font-fraunces text-[2rem] leading-tight text-text-primary">
          <Link
            href={`/journal/${post.slug}`}
            className="hover:text-brand-text"
          >
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className="font-source-serif-4 text-base text-text-secondary">
            {post.excerpt}
          </p>
        )}
        <PostMeta post={post} />
      </div>
    </article>
  )
}

function PostCard({ post }: { post: JournalPostSummary }) {
  return (
    <article className="flex flex-col gap-3">
      <Link
        href={`/journal/${post.slug}`}
        className="relative aspect-[16/10] overflow-hidden rounded-lg bg-bg-sunken"
      >
        {post.cover_image_url && (
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        )}
      </Link>
      <h2 className="font-fraunces text-lg text-text-primary">
        <Link
          href={`/journal/${post.slug}`}
          className="hover:text-brand-text"
        >
          {post.title}
        </Link>
      </h2>
      {post.excerpt && (
        <p className="line-clamp-3 font-source-serif-4 text-sm text-text-secondary">
          {post.excerpt}
        </p>
      )}
      <PostMeta post={post} short />
    </article>
  )
}

function PostMeta({
  post,
  short,
}: {
  post: JournalPostSummary
  short?: boolean
}) {
  const date = formatLongDate(post.published_at ?? post.created_at)
  // The reading time is computed off the excerpt when we don't have full
  // content. It's a rough hint, not a promise.
  const minutes = post.excerpt ? readingMinutes(post.excerpt) : null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-dm-mono text-xs text-text-tertiary">
      {date && <span>{date}</span>}
      {!short && minutes && <span>{minutes} min read</span>}
      {post.tags && post.tags.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {post.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-brand-subtle px-2 py-0.5 text-[11px] font-medium text-brand-subtle-text"
            >
              {t}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}
