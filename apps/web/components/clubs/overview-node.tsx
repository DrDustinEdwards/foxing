import Image from 'next/image'
import Link from 'next/link'
import { WhereToRead } from '@/components/where-to-read'
import type { ClubAnnouncement } from '@/lib/club-announcements'
import type { PublicClub } from '@/lib/queries'
import { AnnouncementsSection } from '@/app/clubs/[slug]/announcements-section'
import { PostAnnouncementForm } from '@/app/clubs/[slug]/post-announcement-form'

export function OverviewNode({
  club,
  bookPath,
  announcements,
  canModerate,
}: {
  club: PublicClub
  bookPath: string | undefined
  announcements: ClubAnnouncement[]
  canModerate: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <AnnouncementsSection
        clubId={club.id}
        announcements={announcements}
        canModerate={canModerate}
      />
      {canModerate && (
        <PostAnnouncementForm
          clubId={club.id}
          defaultCity={club.bookstore_city}
          defaultState={club.bookstore_state}
          canPin
        />
      )}
      {club.current_book && bookPath && (
        <section className="flex flex-col gap-5 rounded-lg border border-border-subtle bg-bg-surface p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <Link
              href={`/book/${bookPath}`}
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
              <p className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-tertiary">
                Reading now
              </p>
              <Link
                href={`/book/${bookPath}`}
                className="font-fraunces text-xl text-text-primary hover:text-brand-text"
              >
                {club.current_book.title}
              </Link>
              <p className="font-dm-sans text-sm text-text-tertiary">
                {club.current_book.author}
              </p>
            </div>
          </div>
          {(club.current_book.source_type === 'community' ||
            !club.current_book.epub_url) && (
            <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
              <p className="font-dm-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">
                Get the book
              </p>
              <WhereToRead
                variant="inline"
                book={{
                  id: club.current_book.id,
                  title: club.current_book.title,
                  author: club.current_book.author,
                  isbn: club.current_book.isbn,
                  isbn13: club.current_book.isbn13,
                  amazon_url: club.current_book.amazon_url,
                  bookshop_url: club.current_book.bookshop_url,
                  source_type: club.current_book.source_type,
                  epub_url: club.current_book.epub_url,
                }}
              />
              <p className="font-dm-sans text-xs text-text-tertiary">
                All members read from the same edition.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
