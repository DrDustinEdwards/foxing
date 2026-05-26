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

function tagLabel(slug: string): string {
  const canonical = JOURNAL_TAGS.find((t) => t.slug === slug)
  if (canonical) return canonical.label
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export async function generateMetadata(
  props: {
    params: Promise<{ tag: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const label = tagLabel(params.tag)
  const description = `Journal entries on ${label.toLowerCase()} from Foxing.`
  return {
    title: `${label} · Foxing Journal`,
    description,
    alternates: {
      canonical: `https://foxing.app/journal/tag/${params.tag}`,
    },
    openGraph: {
      title: `${label} · Foxing Journal`,
      description,
      url: `https://foxing.app/journal/tag/${params.tag}`,
    },
  }
}

export default async function JournalTagPage(
  props: {
    params: Promise<{ tag: string }>
  }
) {
  const params = await props.params;
  const label = tagLabel(params.tag)
  const all = await getJournalPosts()
  const posts = all.filter((p) => p.tags.includes(params.tag))

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
              {label}
            </h1>
            <p className="font-dm-mono text-sm text-text-tertiary">
              {posts.length} {posts.length === 1 ? 'post' : 'posts'}
            </p>
          </header>

          {posts.length === 0 ? (
            <div className="mt-12">
              <EmptyState heading="Nothing here yet." />
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <TagPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

function TagPostCard({ post }: { post: JournalPostSummary }) {
  return (
    <Link
      href={`/journal/${post.slug}`}
      className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-5 no-underline transition-colors hover:border-brand-ui"
    >
      {post.tags[0] && (
        <span className="font-dm-mono text-[0.6875rem] text-text-tertiary">
          {post.tags[0].replace(/-/g, ' ')}
        </span>
      )}
      <p className="font-fraunces text-base leading-snug text-text-primary line-clamp-2">
        {post.title}
      </p>
      {post.excerpt && (
        <p className="flex-1 font-source-serif-4 text-sm text-text-secondary line-clamp-3">
          {post.excerpt}
        </p>
      )}
    </Link>
  );
}
