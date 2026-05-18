import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Book, Club } from '@/types/database'

interface ClubCardProps {
  club: Pick<Club, 'id' | 'name' | 'cover_url'> & { slug?: string | null }
  currentBook?: Pick<Book, 'title' | 'cover_url'> | null
  memberCount?: number
  readingNow?: number
}

export function ClubCard({
  club,
  currentBook,
  memberCount,
  readingNow,
}: ClubCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <Link href={`/clubs/${club.slug ?? club.id}`} className="font-fraunces text-base text-text-primary hover:text-brand-text">
        {club.name}
      </Link>
      {currentBook && (
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-bg-sunken">
            {currentBook.cover_url && (
              <Image
                src={currentBook.cover_url}
                alt={`Cover of ${currentBook.title}`}
                fill
                sizes="48px"
                className="object-cover"
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-dm-sans text-xs uppercase tracking-wide text-text-tertiary">
              Reading now
            </span>
            <span className="truncate font-source-serif-4 text-sm text-text-primary">
              {currentBook.title}
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="font-dm-sans text-xs text-text-tertiary">
          {memberCount ?? 0} members
          {typeof readingNow === 'number' ? ` · ${readingNow} reading now` : ''}
        </span>
        <Link href={`/clubs/${club.slug ?? club.id}`}>
          <Button variant="secondary" size="sm">Join</Button>
        </Link>
      </div>
    </article>
  )
}
