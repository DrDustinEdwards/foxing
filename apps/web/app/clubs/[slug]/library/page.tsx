import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { formatRelativeDate } from '@foxing/utils'
import {
  fetchPublicClubById,
  fetchPublicClubBySlug,
  isUuid,
} from '@/lib/queries'
import { buildClubLibraryMetadata } from '@/lib/metadata'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 300

export async function generateStaticParams() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return []
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('clubs')
    .select('slug')
    .eq('visibility', 'public')
    .not('slug', 'is', null)
    .limit(500)
  return ((data as { slug: string }[] | null) ?? [])
    .filter((c) => Boolean(c.slug))
    .map((c) => ({ slug: c.slug }))
}

async function resolveClub(slugOrId: string) {
  let club = await fetchPublicClubBySlug(slugOrId)
  if (!club && isUuid(slugOrId)) {
    club = await fetchPublicClubById(slugOrId)
  }
  return club
}

interface ClubLibraryRow {
  added_at: string
  added_by: string | null
  added_by_name: string | null
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
    word_count: number | null
  }
}

async function fetchClubLibrary(clubId: string): Promise<ClubLibraryRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('club_books')
    .select(
      'added_at, added_by, books:book_id(id, slug, title, author, cover_url, word_count), adder:added_by(display_name)',
    )
    .eq('club_id', clubId)
    .order('added_at', { ascending: false })
  const rows = (data as unknown as Array<{
    added_at: string
    added_by: string | null
    books: ClubLibraryRow['book'] | null
    adder: { display_name: string | null } | null
  }> | null) ?? []
  return rows
    .filter((r) => r.books !== null)
    .map((r) => ({
      added_at: r.added_at,
      added_by: r.added_by,
      added_by_name: r.adder?.display_name ?? null,
      book: r.books!,
    }))
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const club = await resolveClub(params.slug)
  if (!club) {
    return { title: 'Club not found', robots: { index: false, follow: true } }
  }
  const books = await fetchClubLibrary(club.id)
  return buildClubLibraryMetadata({
    id: club.id,
    slug: club.slug,
    name: club.name,
    book_count: books.length,
  })
}

export default async function ClubLibraryPage(
  props: {
    params: Promise<{ slug: string }>
  }
) {
  const params = await props.params;
  const [club] = await Promise.all([
    resolveClub(params.slug),
  ])
  if (!club) notFound()
  if (isUuid(params.slug) && club.slug && club.slug !== params.slug) {
    permanentRedirect(`/clubs/${club.slug}/library`)
  }
  const books = await fetchClubLibrary(club.id)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <Link
            href={`/clubs/${club.slug ?? club.id}`}
            className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
          >
            ← Back to {club.name}
          </Link>
          <header className="mt-6 flex flex-col gap-2">
            <h1 className="font-fraunces text-[2rem] text-text-primary">
              {club.name} · Library
            </h1>
            <p className="font-source-serif-4 text-base text-text-secondary">
              Every book this club has read together.
            </p>
          </header>

          {books.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              No books in the club library yet.
            </p>
          ) : (
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {books.map((b) => {
                const bookHref = `/book/${b.book.slug ?? b.book.id}`
                return (
                  <li
                    key={`${b.book.id}-${b.added_at}`}
                    className="flex gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4"
                  >
                    <Link
                      href={bookHref}
                      className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-bg-sunken"
                    >
                      {b.book.cover_url && (
                        <Image
                          src={b.book.cover_url}
                          alt={b.book.title}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-col gap-1">
                      <Link
                        href={bookHref}
                        className="truncate font-fraunces text-base text-text-primary hover:text-brand-text"
                      >
                        {b.book.title}
                      </Link>
                      <p className="truncate font-dm-sans text-sm text-text-tertiary">
                        {b.book.author}
                      </p>
                      <p className="font-dm-mono text-xs text-text-tertiary">
                        Added {formatRelativeDate(b.added_at)}
                        {b.added_by_name ? ` by ${b.added_by_name}` : ''}
                      </p>
                    </div>
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
