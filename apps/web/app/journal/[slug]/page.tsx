import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Markdown } from '@/components/markdown'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  fetchAllJournalSlugs,
  fetchJournalPostBySlug,
  fetchRelatedPosts,
  formatLongDate,
  readingMinutes,
  type JournalPostSummary,
} from '@/lib/journal'
import { getNavUser } from '@/lib/nav-user'
import { buildJournalPostMetadata, FOXING_BASE_URL } from '@/lib/metadata'

export const revalidate = 3600

export async function generateStaticParams() {
  const slugs = await fetchAllJournalSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = await fetchJournalPostBySlug(params.slug)
  if (!post) return { title: 'Post not found' }
  return buildJournalPostMetadata({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    cover_image_url: post.cover_image_url,
    published_at: post.published_at,
    tags: post.tags,
  })
}

export default async function JournalPostPage({
  params,
}: {
  params: { slug: string }
}) {
  const [navUser, post] = await Promise.all([
    getNavUser(),
    fetchJournalPostBySlug(params.slug),
  ])
  if (!post) notFound()

  const related = await fetchRelatedPosts(post.slug, post.tags ?? [], 3)
  const minutes = readingMinutes(post.content)
  const dateLabel = formatLongDate(post.published_at ?? post.created_at)
  const jsonLd = articleJsonLd(post)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <main className="flex-1">
        {post.cover_image_url && (
          <div className="relative h-[50vh] min-h-[300px] w-full overflow-hidden bg-bg-sunken">
            <Image
              src={post.cover_image_url}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-base)]"
            />
          </div>
        )}

        <PageWrapper className="max-w-prose py-10 md:py-14">
          <header className="flex flex-col gap-3">
            <h1 className="font-fraunces text-[2.5rem] leading-tight text-text-primary md:text-[3rem]">
              {post.title}
            </h1>
            <p className="flex flex-wrap gap-x-3 gap-y-1 font-dm-sans text-sm text-text-tertiary">
              {dateLabel && <span>{dateLabel}</span>}
              <span>{minutes} min read</span>
              {post.tags && post.tags.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {post.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-brand-subtle px-2 py-0.5 font-dm-mono text-[11px] font-medium text-brand-subtle-text"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </p>
          </header>

          <article className="mt-8 text-[18px] leading-[1.85]">
            <Markdown source={post.content} />
          </article>

          <div className="mt-12 border-t border-border-subtle pt-6">
            <Link
              href="/journal"
              className="font-dm-sans text-sm text-brand-text hover:underline"
            >
              ← All posts
            </Link>
          </div>
        </PageWrapper>

        {related.length > 0 && (
          <section className="bg-bg-surface">
            <PageWrapper className="py-12">
              <h2 className="mb-6 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                More from the journal
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                {related.map((r) => (
                  <RelatedCard key={r.id} post={r} />
                ))}
              </div>
            </PageWrapper>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}

function RelatedCard({ post }: { post: JournalPostSummary }) {
  return (
    <Link
      href={`/journal/${post.slug}`}
      className="flex flex-col gap-2 transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-bg-sunken">
        {post.cover_image_url && (
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        )}
      </div>
      <h3 className="font-fraunces text-base text-text-primary">
        {post.title}
      </h3>
      {post.excerpt && (
        <p className="line-clamp-2 font-source-serif-4 text-sm text-text-secondary">
          {post.excerpt}
        </p>
      )}
    </Link>
  )
}

function articleJsonLd(post: {
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  published_at: string | null
  updated_at: string
  tags: string[] | null
}): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${FOXING_BASE_URL}/journal/${post.slug}`,
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.cover_image_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? post.published_at ?? undefined,
    keywords: post.tags?.join(', '),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${FOXING_BASE_URL}/journal/${post.slug}`,
    },
    author: {
      '@type': 'Organization',
      name: 'Foxing',
      url: FOXING_BASE_URL,
    },
    isPartOf: {
      '@type': 'Blog',
      name: 'Foxing Journal',
      url: `${FOXING_BASE_URL}/journal`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Foxing',
      logo: {
        '@type': 'ImageObject',
        url: `${FOXING_BASE_URL}/icon.png`,
      },
      url: FOXING_BASE_URL,
    },
  }
  return JSON.stringify(data)
}
