import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { ReadingProgress } from '@/components/reading-progress'
import { estimateReadingTime, type JournalPost } from '@/lib/journal'
import {
  extractH2Headings,
  renderJournalMarkdown,
} from '@/lib/journal-markdown'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Draft preview · Admin · Foxing',
  robots: { index: false, follow: false },
}

export default async function AdminJournalPreviewPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const admin = createAdminClient()
  const { data } = await admin
    .from('journal_posts')
    .select(
      'id, slug, title, excerpt, content, cover_image_url, is_published, published_at, tags, featured, og_title, og_description, canonical_url, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle()
  const post = data as JournalPost | null
  if (!post) notFound()
  const tags = post.tags ?? []

  const headings = extractH2Headings(post.content)
  const body = renderJournalMarkdown(post.content)
  const minutes = estimateReadingTime(post.content)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <ReadingProgress />
      <main className="flex-1">
        <div className="border-b border-brand-ui bg-brand-subtle px-4 py-2 text-brand-subtle-text">
          <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-2">
            <span className="font-dm-sans text-sm">
              <strong className="font-medium">[Draft preview]</strong>{' '}
              {post.is_published
                ? 'This post is already published.'
                : 'This post is not published.'}
            </span>
            <Link
              href={`/admin/journal/${post.id}`}
              className="font-dm-sans text-sm font-medium text-brand-text hover:underline"
            >
              Edit
            </Link>
          </div>
        </div>
        <PageWrapper className="py-10 md:py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)]">
            <article className="min-w-0">
              <p className="mb-6">
                <Link
                  href="/admin/journal"
                  className="font-dm-sans text-sm text-text-tertiary no-underline hover:text-text-primary"
                >
                  ← Admin journal
                </Link>
              </p>

              <header className="flex flex-col gap-3 border-b border-border-subtle pb-6">
                {tags.length > 0 && (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 font-dm-mono text-[0.6875rem] text-text-tertiary">
                    {tags.map((t) => (
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
  )
}
