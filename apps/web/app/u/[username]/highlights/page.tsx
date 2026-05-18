import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PrivateProfileNotice } from '@/components/private-profile-notice'
import { UserSubpageHeader } from '@/components/user-subpage-header'
import { fetchProfileByUsername } from '@/lib/queries'
import {
  fetchPublicUserHighlights,
  fetchUserCounts,
} from '@/lib/missing-pages-queries'
import { buildUserHighlightsMetadata } from '@/lib/metadata'
import { getNavUser } from '@/lib/nav-user'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const profile = await fetchProfileByUsername(params.username)
  if (!profile || !profile.is_public) {
    return { title: 'Profile not found', robots: { index: false, follow: true } }
  }
  const counts = await fetchUserCounts(profile.id)
  return buildUserHighlightsMetadata({
    display_name: profile.display_name,
    username: profile.username,
    highlight_count: counts.highlight_count,
  })
}

export default async function UserHighlightsPage({
  params,
  searchParams,
}: {
  params: { username: string }
  searchParams: { book?: string }
}) {
  const [navUser, profile] = await Promise.all([
    getNavUser(),
    fetchProfileByUsername(params.username),
  ])
  if (!profile) notFound()
  if (!profile.is_public) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base">
        <Nav user={navUser} />
        <main className="flex-1">
          <PrivateProfileNotice username={profile.username} />
        </main>
        <Footer />
      </div>
    )
  }
  const highlights = await fetchPublicUserHighlights(
    profile.id,
    searchParams.book,
  )

  const grouped = new Map<
    string,
    {
      book: (typeof highlights)[number]['book']
      items: typeof highlights
    }
  >()
  for (const h of highlights) {
    const existing = grouped.get(h.book.id) ?? { book: h.book, items: [] }
    existing.items.push(h)
    grouped.set(h.book.id, existing)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <UserSubpageHeader
            username={profile.username}
            displayName={profile.display_name}
            section="highlights"
          />

          {highlights.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No public highlights yet.
            </p>
          ) : (
            <div className="mt-8 flex flex-col gap-10">
              {Array.from(grouped.values()).map(({ book, items }) => (
                <section key={book.id} className="flex flex-col gap-3">
                  <Link
                    href={`/book/${book.id}`}
                    className="font-fraunces text-base text-text-primary hover:text-brand-text"
                  >
                    {book.title}{' '}
                    <span className="font-dm-sans text-xs text-text-tertiary">
                      · {book.author}
                    </span>
                  </Link>
                  <ul className="flex flex-col gap-3">
                    {items.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-col gap-2 rounded-lg border-l-[3px] border-brand-ui bg-bg-surface p-4"
                      >
                        <blockquote className="font-source-serif-4 text-[15px] italic text-text-primary">
                          {h.text}
                        </blockquote>
                        {h.note && (
                          <p className="font-dm-sans text-xs text-text-secondary">
                            {h.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
