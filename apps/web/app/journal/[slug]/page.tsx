import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ReadingProgress } from '@/components/reading-progress'
import {
  getAdjacentJournalPostsStatic,
  getJournalPostStatic,
  type JournalPost,
} from '@/lib/journal'
import {
  estimateReadingTime,
  JOURNAL_TAGS,
} from '@/lib/journal-shared'
import {
  extractFaqPairs,
  extractH2Headings,
  renderJournalMarkdown,
} from '@/lib/journal-markdown'
import { createAdminClient } from '@/lib/supabase/admin'
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/journal/Icons'
import { ShareBar } from '@/components/journal/ShareBar'

export const revalidate = 3600

export async function generateStaticParams() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('journal_posts')
    .select('slug')
    .eq('is_published', true)
  return ((data as { slug: string }[] | null) ?? []).map((p) => ({
    slug: p.slug,
  }))
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const post = await getJournalPostStatic(params.slug)
  if (!post) return {}
  const ogTitle = post.og_title ?? post.title
  const description = post.og_description ?? post.excerpt ?? ''
  const ogImage = `https://foxing.app/og?type=journal&title=${encodeURIComponent(
    ogTitle,
  )}&excerpt=${encodeURIComponent(description)}`
  return {
    title: `${ogTitle} · Foxing Journal`,
    description,
    alternates: {
      canonical:
        post.canonical_url ?? `https://foxing.app/journal/${post.slug}`,
    },
    openGraph: {
      title: ogTitle,
      description,
      url: `https://foxing.app/journal/${post.slug}`,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [ogImage],
    },
  }
}

export default async function JournalPostPage(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const post = await getJournalPostStatic(params.slug)
  if (!post) notFound()

  const { prev, next } = post.published_at
    ? await getAdjacentJournalPostsStatic(post.published_at, post.id)
    : { prev: null, next: null }

  const headings = extractH2Headings(post.content)
  const faqPairs = extractFaqPairs(post.content)
  const body = await renderJournalMarkdown(post.content)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <ReadingProgress />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: articleJsonLd(post) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd(post) }}
      />
      {faqPairs.length > 0 && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: faqJsonLd(faqPairs) }}
        />
      )}
      <main className="flex-1">
        <PageWrapper className="py-10 md:py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)]">
            <article className="min-w-0">
              <p className="mb-6">
                <Link
                  href="/journal"
                  className="group inline-flex items-center gap-1.5 font-dm-sans text-sm text-text-tertiary no-underline hover:text-text-primary transition-colors"
                >
                  <ArrowLeftIcon className="transition-transform group-hover:-translate-x-0.5" />
                  Journal
                </Link>
              </p>

              <header className="flex flex-col gap-3 border-b border-border-subtle pb-6">
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((slug) => (
                      <TagPill key={slug} slug={slug} />
                    ))}
                  </div>
                )}
                <p className="font-dm-mono text-sm text-text-tertiary">
                  {post.show_published_at && post.published_at ? (
                    <>
                      {new Date(post.published_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {' · '}
                    </>
                  ) : null}
                  {post.show_updated_at &&
                  post.published_at &&
                  post.updated_at &&
                  new Date(post.updated_at).getTime() -
                    new Date(post.published_at).getTime() >
                    24 * 60 * 60 * 1000 ? (
                    <>
                      Updated{' '}
                      {new Date(post.updated_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {' · '}
                    </>
                  ) : null}
                  {post.reading_time_minutes ??
                    estimateReadingTime(post.content)}{' '}
                  min read
                </p>
                <h1 className="font-fraunces text-[2rem] leading-tight text-text-primary">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="font-source-serif-4 text-[1.0625rem] leading-relaxed text-text-secondary">
                    {post.excerpt}
                  </p>
                )}
              </header>

              <ShareBar
                title={post.title}
                url={`https://foxing.app/journal/${post.slug}`}
              />

              {headings.length > 1 && (
                <details className="mt-6 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 lg:hidden">
                  <summary className="flex cursor-pointer items-center justify-between font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
                    <span>Contents</span>
                    <span aria-hidden="true">+</span>
                  </summary>
                  <ol className="mt-3 flex flex-col gap-2 font-source-serif-4 text-sm text-text-secondary">
                    {headings.map((h) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className="no-underline hover:text-brand-text"
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              <div
                className="journal-prose mt-8"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: body }}
              />

              {(prev || next) && (
                <section className="mt-12 border-t border-border-subtle pt-6">
                  <p className="mb-3 font-dm-mono text-[0.6875rem] uppercase tracking-[0.12em] text-text-tertiary">
                    Further reading
                  </p>
                  <ul className="flex flex-col gap-2">
                    {prev && (
                      <li>
                        <Link
                          href={`/journal/${prev.slug}`}
                          className="group inline-flex items-center gap-1.5 font-source-serif-4 text-base text-text-primary no-underline hover:text-brand-text transition-colors"
                        >
                          {prev.title}
                          <ArrowRightIcon className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </Link>
                      </li>
                    )}
                    {next && (
                      <li>
                        <Link
                          href={`/journal/${next.slug}`}
                          className="group inline-flex items-center gap-1.5 font-source-serif-4 text-base text-text-primary no-underline hover:text-brand-text transition-colors"
                        >
                          {next.title}
                          <ArrowRightIcon className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </Link>
                      </li>
                    )}
                  </ul>
                </section>
              )}

              <AuthorByline />

              {(prev || next) && (
                <nav className="mt-6 grid gap-3 sm:grid-cols-2">
                  {prev ? (
                    <Link
                      href={`/journal/${prev.slug}`}
                      className="group flex flex-col gap-1 rounded-lg border border-border-subtle bg-bg-surface p-4 no-underline transition-colors hover:border-border-interactive"
                    >
                      <span className="inline-flex items-center gap-1 font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
                        <ArrowLeftIcon className="transition-transform group-hover:-translate-x-0.5" />
                        Previous
                      </span>
                      <span className="font-fraunces text-base text-text-primary">
                        {prev.title}
                      </span>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {next ? (
                    <Link
                      href={`/journal/${next.slug}`}
                      className="group flex flex-col gap-1 rounded-lg border border-border-subtle bg-bg-surface p-4 text-right no-underline transition-colors hover:border-border-interactive"
                    >
                      <span className="inline-flex items-center justify-end gap-1 font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
                        Next
                        <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                      <span className="font-fraunces text-base text-text-primary">
                        {next.title}
                      </span>
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}

              <section className="mt-12 flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-6">
                <h2 className="font-fraunces text-[1.375rem] text-text-primary">
                  Start reading.
                </h2>
                <p className="font-source-serif-4 text-sm text-text-secondary">
                  1,400+ classic books, free. An AI companion that reads with
                  you.
                </p>
                <div>
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center rounded-md bg-brand-ui px-4 py-2 font-dm-sans text-sm text-text-on-brand no-underline hover:bg-brand-hover"
                  >
                    Join free →
                  </Link>
                </div>
              </section>
            </article>

            {headings.length > 1 && (
              <aside className="hidden lg:block">
                <div className="sticky top-8 flex flex-col gap-3">
                  <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
                    Contents
                  </p>
                  <ol className="flex flex-col gap-2 font-source-serif-4 text-sm text-text-secondary">
                    {headings.map((h) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className="no-underline transition-colors hover:text-brand-text"
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </aside>
            )}
          </div>
        </PageWrapper>
      </main>
      <Footer />
    </div>
  );
}

function TagPill({ slug }: { slug: string }) {
  const label =
    JOURNAL_TAGS.find((t) => t.slug === slug)?.label ??
    slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <Link
      href={`/journal/tag/${slug}`}
      className="self-start rounded-full bg-brand-subtle px-3 py-1 font-dm-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brand-subtle-text no-underline transition-colors hover:bg-brand-ui hover:text-text-on-brand"
    >
      {label}
    </Link>
  )
}

function AuthorByline() {
  return (
    <section className="mt-8 flex items-center gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="presentation"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="byline-mark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-secondary)" />
            <stop offset="100%" stopColor="var(--brand-ui)" />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r="22" fill="url(#byline-mark)" />
        <text
          x="22"
          y="29"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="22"
          fontWeight="600"
          fill="var(--text-on-brand)"
        >
          F
        </text>
      </svg>
      <div className="flex min-w-0 flex-col">
        <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.08em] text-text-tertiary">
          Published by
        </p>
        <p className="font-fraunces text-base text-text-primary">Foxing</p>
        <p className="font-source-serif-4 text-sm text-text-secondary">
          Reading 1,400+ classic books, together.
        </p>
      </div>
    </section>
  )
}

function articleJsonLd(post: JournalPost): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.og_description ?? post.excerpt ?? '',
    url: `https://foxing.app/journal/${post.slug}`,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Organization',
      name: 'Foxing',
      url: 'https://foxing.app',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Foxing',
      url: 'https://foxing.app',
      logo: {
        '@type': 'ImageObject',
        url: 'https://foxing.app/icon.png',
      },
    },
  }
  return JSON.stringify(data)
}

function faqJsonLd(
  pairs: Array<{ question: string; answer: string }>,
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  })
}

function breadcrumbJsonLd(post: JournalPost): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://foxing.app',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Journal',
        item: 'https://foxing.app/journal',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `https://foxing.app/journal/${post.slug}`,
      },
    ],
  }
  return JSON.stringify(data)
}
