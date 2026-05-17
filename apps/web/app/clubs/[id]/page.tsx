import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Footer } from '@/components/layout/footer'
import { Nav } from '@/components/layout/nav'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { formatRelativeDate } from '@foxing/utils'
import {
  fetchClubPostsPreview,
  fetchPublicClubById,
} from '@/lib/queries'
import { getNavUser } from '@/lib/nav-user'
import { appClubDeeplink, siteOrigin } from '@/lib/foxing'

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const club = await fetchPublicClubById(params.id)
  if (!club) return { title: 'Club not found · Foxing' }
  const description =
    club.description ?? `${club.member_count} readers in this club.`
  const origin = siteOrigin()
  return {
    title: `${club.name} · Foxing`,
    description,
    alternates: { canonical: `${origin}/clubs/${club.id}` },
    openGraph: {
      title: club.name,
      description,
      url: `${origin}/clubs/${club.id}`,
      images: club.cover_url ? [{ url: club.cover_url }] : undefined,
    },
  }
}

export default async function ClubPage({
  params,
}: {
  params: { id: string }
}) {
  const [navUser, club] = await Promise.all([
    getNavUser(),
    fetchPublicClubById(params.id),
  ])
  if (!club) notFound()
  const posts = await fetchClubPostsPreview(club.id, 3)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <Nav user={navUser} />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <header className="flex flex-col gap-3">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              {club.name}
            </h1>
            <p className="font-dm-sans text-sm text-text-tertiary">
              {club.member_count} members
            </p>
            {club.description && (
              <p className="max-w-prose font-source-serif-4 text-base text-text-secondary">
                {club.description}
              </p>
            )}
          </header>

          {club.current_book && (
            <section className="mt-8 flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-surface p-5 md:flex-row md:items-start">
              <Link
                href={`/book/${club.current_book.id}`}
                className="relative h-44 w-32 shrink-0 overflow-hidden rounded-md bg-bg-sunken"
              >
                {club.current_book.cover_url && (
                  <Image
                    src={club.current_book.cover_url}
                    alt={club.current_book.title}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                )}
              </Link>
              <div className="flex flex-col gap-2">
                <p className="font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                  Reading now
                </p>
                <Link
                  href={`/book/${club.current_book.id}`}
                  className="font-fraunces text-xl text-text-primary hover:text-brand-text"
                >
                  {club.current_book.title}
                </Link>
                <p className="font-dm-sans text-sm text-text-tertiary">
                  {club.current_book.author}
                </p>
              </div>
            </section>
          )}

          <section className="mt-10 flex flex-wrap items-center gap-3">
            <Link href={appClubDeeplink(club.id)}>
              <Button variant="primary" size="md">
                Join this club
              </Button>
            </Link>
            <Link href={appClubDeeplink(club.id)}>
              <Button variant="secondary" size="md">
                See all discussions in the app
              </Button>
            </Link>
          </section>

          {posts.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 font-dm-sans text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                Recent discussion
              </h2>
              <div className="flex flex-col gap-4">
                {posts.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-lg border border-border-subtle bg-bg-surface p-4"
                  >
                    <header className="flex items-center gap-2">
                      <Avatar
                        src={p.author?.avatar_url}
                        name={p.author?.display_name ?? 'Reader'}
                        size="sm"
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="font-dm-sans text-sm text-text-primary">
                          {p.author?.display_name ?? 'Reader'}
                        </span>
                        <time className="font-dm-mono text-xs text-text-tertiary">
                          {formatRelativeDate(p.created_at)}
                        </time>
                      </div>
                    </header>
                    <p className="mt-3 line-clamp-4 font-source-serif-4 text-base text-text-secondary">
                      {p.content}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}
