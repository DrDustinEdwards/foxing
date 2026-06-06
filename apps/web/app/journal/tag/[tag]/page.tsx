import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Card,
  CardBody,
  CardLabel,
  CardMeta,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { JournalPageShell } from '@/components/journal/JournalPageShell'
import {
  getJournalPostsStatic,
  JOURNAL_TAGS,
  type JournalPostSummary,
} from '@/lib/journal'
import { ArrowLeftIcon } from '@/components/journal/Icons'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600
export const dynamic = 'force-static'

export async function generateStaticParams() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return JOURNAL_TAGS.map((t) => ({ tag: t.slug }))
  }
  const tags = new Set<string>(JOURNAL_TAGS.map((t) => t.slug))
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('journal_posts')
      .select('tags')
      .eq('is_published', true)
    for (const row of (data as { tags: string[] | null }[] | null) ?? []) {
      for (const t of row.tags ?? []) tags.add(t)
    }
  } catch {
    // Fall through with canonical tags only.
  }
  return [...tags].map((tag) => ({ tag }))
}

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
  const all = await getJournalPostsStatic()
  const posts = all.filter((p) => p.tags.includes(params.tag))

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
    </JournalPageShell>
  )
}

function TagPostCard({ post }: { post: JournalPostSummary }) {
  const minutes = post.reading_time_minutes ?? null
  return (
    <Card
      variant="content"
      href={`/journal/${post.slug}`}
      className="p-5 gap-2"
    >
      {post.tags[0] && (
        <CardLabel>{post.tags[0].replace(/-/g, ' ')}</CardLabel>
      )}
      <CardTitle className="line-clamp-2">{post.title}</CardTitle>
      {post.excerpt && (
        <CardBody className="flex-1 line-clamp-3">{post.excerpt}</CardBody>
      )}
      {minutes && minutes > 0 && (
        <CardMeta className="mt-1">{minutes} min read</CardMeta>
      )}
    </Card>
  )
}
