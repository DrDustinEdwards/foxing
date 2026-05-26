import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import {
  estimateReadingTime,
  getAdjacentJournalPosts,
  getJournalPost,
  type JournalPost,
} from '@/lib/journal'
import {
  extractH2Headings,
  renderJournalMarkdown,
} from '@/lib/journal-markdown'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const post = await getJournalPost(params.slug)
  if (!post) return {}
  const description = post.og_description ?? post.excerpt ?? ''
  return {
    title: `${post.og_title ?? post.title} · Foxing Journal`,
    description,
    alternates: {
      canonical:
        post.canonical_url ?? `https://foxing.app/journal/${post.slug}`,
    },
    openGraph: {
      title: post.og_title ?? post.title,
      description,
      url: `https://foxing.app/journal/${post.slug}`,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
    },
  }
}

export default async function JournalPostPage(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const post = await getJournalPost(params.slug)
  if (!post) notFound()

  const { prev, next } = post.published_at
    ? await getAdjacentJournalPosts(post.published_at, post.id)
    : { prev: null, next: null }

  const headings = extractH2Headings(post.content)
  const body = renderJournalMarkdown(post.content)
  const minutes = estimateReadingTime(post.content)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
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
      <main className="flex-1">
        <PageWrapper className="py-10 md:py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)]">
            <article className="min-w-0">
              <p className="mb-6">
                <Link
                  href="/journal"
                  className="font-dm-sans text-sm text-text-tertiary no-underline hover:text-text-primary"
                >
                  ← Journal
                </Link>
              </p>

              <header className="flex flex-col gap-3 border-b border-border-subtle pb-6">
                {post.tags.length > 0 && (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 font-dm-mono text-[0.6875rem] text-text-tertiary">
                    {post.tags.map((t) => (
                      <span key={t}>{t.replace(/-/g, ' ')}</span>
                    ))}
                  </p>
                )}
                <p className="font-dm-mono text-sm text-text-tertiary">
                  {minutes} min read · Foxing
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
                          className="font-source-serif-4 text-base text-text-primary no-underline hover:text-brand-text"
                        >
                          {prev.title}
                        </Link>
                      </li>
                    )}
                    {next && (
                      <li>
                        <Link
                          href={`/journal/${next.slug}`}
                          className="font-source-serif-4 text-base text-text-primary no-underline hover:text-brand-text"
                        >
                          {next.title}
                        </Link>
                      </li>
                    )}
                  </ul>
                </section>
              )}

              {(prev || next) && (
                <nav className="mt-6 grid gap-3 sm:grid-cols-2">
                  {prev ? (
                    <Link
                      href={`/journal/${prev.slug}`}
                      className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-bg-surface p-4 no-underline transition-colors hover:border-brand-ui"
                    >
                      <span className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
                        ← Previous
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
                      className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-bg-surface p-4 text-right no-underline transition-colors hover:border-brand-ui"
                    >
                      <span className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
                        Next →
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
