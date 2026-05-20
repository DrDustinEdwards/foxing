import Link from 'next/link'
import { formatRelativeDate } from '@foxing/utils'
import type { Bookmark } from '@/lib/bookmarks'
import { appBookDeeplink } from '@/lib/foxing'
import { BookmarkDeleteButton } from './bookmark-delete-button'

interface Props {
  bookmarks: Bookmark[]
  bookId: string
  bookSlug: string | null
}

export function BookmarksSection({ bookmarks, bookId, bookSlug }: Props) {
  return (
    <section className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <details>
        <summary className="cursor-pointer font-dm-sans text-sm text-text-secondary">
          Bookmarks ({bookmarks.length})
        </summary>
        <div className="mt-3">
          {bookmarks.length === 0 ? (
            <p className="font-source-serif-4 text-sm text-text-tertiary">
              No bookmarks yet. Tap the bookmark icon while reading to save
              your place by name.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
              {bookmarks.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex flex-col leading-tight">
                    <span className="font-fraunces text-sm text-text-primary">
                      {b.name ?? 'Unnamed bookmark'}
                    </span>
                    <span className="font-dm-mono text-xs text-text-tertiary">
                      Saved {formatRelativeDate(b.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={appBookDeeplink(bookId)}
                      className="font-dm-mono text-xs text-brand-text hover:underline"
                    >
                      Open in app
                    </Link>
                    <BookmarkDeleteButton
                      bookmarkId={b.id}
                      bookSlug={bookSlug}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </section>
  )
}
