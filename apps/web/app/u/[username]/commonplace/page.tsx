import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { formatRelativeDate } from '@foxing/utils'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { fetchPublicCommonplace } from '@/lib/commonplace'
import { fetchProfileByUsername } from '@/lib/queries'
import { FOXING_BASE_URL } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: {
    params: Promise<{ username: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const profile = await fetchProfileByUsername(params.username)
  if (!profile) return { title: 'Profile not found' }
  return {
    title: `${profile.display_name}'s commonplace book · Foxing`,
    alternates: {
      canonical: `${FOXING_BASE_URL}/u/${params.username}/commonplace`,
    },
    robots: { index: profile.is_public, follow: true },
  }
}

export default async function PublicCommonplacePage(
  props: {
    params: Promise<{ username: string }>
  }
) {
  const params = await props.params;
  const [profile] = await Promise.all([
    fetchProfileByUsername(params.username),
  ])
  if (!profile) notFound()
  const entries = profile.is_public
    ? await fetchPublicCommonplace(profile.id, 200)
    : []

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <Link
            href={`/u/${profile.username}`}
            className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
          >
            ← {profile.display_name}
          </Link>
          <h1 className="mt-4 font-fraunces text-[2rem] text-text-primary">
            {profile.display_name}&apos;s commonplace book
          </h1>
          <p className="mt-1 font-source-serif-4 text-base text-text-tertiary">
            {entries.length} public {entries.length === 1 ? 'passage' : 'passages'}
          </p>

          {entries.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              Nothing public here yet.
            </p>
          ) : (
            <ul className="mt-6 flex flex-col gap-4">
              {entries.map((e) => {
                const bookPath = e.book?.slug ?? e.book?.id
                return (
                  <li
                    key={e.id}
                    className="rounded-lg border border-border-subtle bg-bg-surface p-4"
                  >
                    <blockquote className="border-l-2 border-brand-ui pl-4 font-source-serif-4 text-base italic text-text-primary">
                      {e.passage_text}
                    </blockquote>
                    <div className="mt-2 flex flex-wrap gap-2 font-dm-mono text-xs text-text-tertiary">
                      {e.book?.title && bookPath ? (
                        <Link
                          href={`/book/${bookPath}`}
                          className="hover:text-text-primary"
                        >
                          {e.book.title}
                          {e.book.author && ` by ${e.book.author}`}
                        </Link>
                      ) : e.book_title ? (
                        <span>{e.book_title}</span>
                      ) : null}
                      <span>· {formatRelativeDate(e.created_at)}</span>
                    </div>
                    {e.note && (
                      <p className="mt-2 font-source-serif-4 text-sm text-text-secondary">
                        {e.note}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
