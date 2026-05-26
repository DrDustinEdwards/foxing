import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/layout/footer'
import { NavAuthClient } from '@/components/layout/nav-auth-client'
import { PageWrapper } from '@/components/layout/page-wrapper'
import { PrivateProfileNotice } from '@/components/private-profile-notice'
import { StarRating } from '@/components/ui/star-rating'
import { UserSubpageHeader } from '@/components/user-subpage-header'
import { fetchProfileByUsername } from '@/lib/queries'
import {
  fetchPublicLibrary,
  fetchUserCounts,
} from '@/lib/missing-pages-queries'
import { buildUserLibraryMetadata } from '@/lib/metadata'
import { cn } from '@/lib/cn'

export const revalidate = 300

const TABS: Array<{ id: string; label: string; status?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'reading', label: 'Reading', status: 'reading' },
  { id: 'finished', label: 'Finished', status: 'finished' },
  { id: 'want_to_read', label: 'Want to Read', status: 'want_to_read' },
  { id: 'paused', label: 'Paused', status: 'paused' },
  { id: 'abandoned', label: 'Abandoned', status: 'abandoned' },
]

export async function generateMetadata(
  props: {
    params: Promise<{ username: string }>
  }
): Promise<Metadata> {
  const params = await props.params;
  const profile = await fetchProfileByUsername(params.username)
  if (!profile || !profile.is_public) {
    return { title: 'Profile not found', robots: { index: false, follow: true } }
  }
  const counts = await fetchUserCounts(profile.id)
  return buildUserLibraryMetadata({
    display_name: profile.display_name,
    username: profile.username,
    books_count: counts.books_count,
  })
}

export default async function UserLibraryPage(
  props: {
    params: Promise<{ username: string }>
    searchParams: Promise<{ status?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [profile] = await Promise.all([
    fetchProfileByUsername(params.username),
  ])
  if (!profile) notFound()

  if (!profile.is_public) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-base">
        <NavAuthClient />
        <main className="flex-1">
          <PrivateProfileNotice username={profile.username} />
        </main>
        <Footer />
      </div>
    )
  }

  const tab = TABS.find((t) => t.id === searchParams.status)?.id ?? 'all'
  const status = TABS.find((t) => t.id === tab)?.status
  const items = await fetchPublicLibrary(profile.id, status)

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <NavAuthClient />
      <main className="flex-1">
        <PageWrapper className="py-10">
          <UserSubpageHeader
            username={profile.username}
            displayName={profile.display_name}
            section="library"
          />

          <nav
            aria-label="Library status"
            className="mt-6 flex flex-wrap gap-1 border-b border-border-subtle"
          >
            {TABS.map((t) => {
              const href =
                t.id === 'all'
                  ? `/u/${profile.username}/library`
                  : `/u/${profile.username}/library?status=${t.id}`
              return (
                <Link
                  key={t.id}
                  href={href}
                  className={cn(
                    '-mb-px border-b-2 px-4 py-2 font-dm-sans text-sm transition-colors',
                    tab === t.id
                      ? 'border-brand-ui text-text-primary'
                      : 'border-transparent text-text-tertiary hover:text-text-primary',
                  )}
                >
                  {t.label}
                </Link>
              )
            })}
          </nav>

          {items.length === 0 ? (
            <p className="mt-10 font-source-serif-4 text-base text-text-tertiary">
              Nothing on this shelf.
            </p>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/book/${entry.book.slug ?? entry.book.id}`}
                    className="group flex flex-col gap-2"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-bg-sunken shadow-sm transition-shadow group-hover:shadow-md">
                      {entry.book.cover_url && (
                        <Image
                          src={entry.book.cover_url}
                          alt={entry.book.title}
                          fill
                          sizes="(max-width: 768px) 45vw, 18vw"
                          className="object-cover"
                        />
                      )}
                      {entry.status === 'paused' && (
                        <Badge variant="warning" className="absolute right-2 top-2">
                          Paused
                        </Badge>
                      )}
                      {entry.status === 'abandoned' && (
                        <Badge variant="neutral" className="absolute right-2 top-2">
                          Set aside
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="truncate font-fraunces text-sm text-text-primary">
                        {entry.book.title}
                      </p>
                      <p className="truncate font-dm-sans text-xs text-text-tertiary">
                        {entry.book.author}
                      </p>
                      {entry.status === 'finished' &&
                        typeof entry.rating === 'number' && (
                          <StarRating value={entry.rating} size="sm" readOnly />
                        )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PageWrapper>
      </main>
      <Footer />
    </div>
  )
}

