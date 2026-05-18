'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { BookSearchAdd } from '@/components/book-search-add'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/ui/star-rating'
import { cn } from '@/lib/cn'
import { logDiaryEntry } from './log-action'

interface SelectedBook {
  id: string
  title: string
  author: string
  cover_url: string | null
}

export function LogEntryDialog() {
  const [open, setOpen] = useState(false)
  const [book, setBook] = useState<SelectedBook | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [ratingHalf, setRatingHalf] = useState<number | null>(null)
  const [review, setReview] = useState('')
  const [privacy, setPrivacy] = useState<'private' | 'friends' | 'public'>(
    'private',
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setBook(null)
    setDate(new Date().toISOString().slice(0, 10))
    setRatingHalf(null)
    setReview('')
    setPrivacy('private')
    setError(null)
  }

  function close() {
    setOpen(false)
    reset()
  }

  function submit() {
    if (!book) {
      setError('Pick a book first.')
      return
    }
    setError(null)
    startTransition(() => {
      void logDiaryEntry({
        book_id: book.id,
        log_date: date,
        rating_half: ratingHalf,
        review,
        privacy,
      }).then((result) => {
        if (result.ok) close()
        else setError(result.error)
      })
    })
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Log a book
      </Button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Log a book"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        >
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-border-default bg-bg-elevated p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-fraunces text-xl text-text-primary">
                Log a book
              </h2>
              <button
                type="button"
                onClick={close}
                className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            {book ? (
              <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface p-3">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-bg-sunken">
                  {book.cover_url && (
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate font-fraunces text-sm text-text-primary">
                    {book.title}
                  </p>
                  <p className="truncate font-dm-sans text-xs text-text-tertiary">
                    {book.author}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBook(null)}
                  className="font-dm-sans text-xs text-text-tertiary hover:text-text-primary"
                >
                  Change
                </button>
              </div>
            ) : (
              <BookSearchAdd
                onSelect={(b) =>
                  setBook({
                    id: b.id,
                    title: b.title,
                    author: b.author,
                    cover_url: b.cover_url,
                  })
                }
                placeholder="Search for a book"
                autoFocus
              />
            )}

            <label className="flex flex-col gap-1">
              <span className="font-dm-sans text-sm text-text-secondary">
                Date
              </span>
              <input
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-md border border-border-interactive bg-bg-surface px-3 font-dm-sans text-base text-text-primary"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="font-dm-sans text-sm text-text-secondary">
                Rating
              </span>
              <StarRating
                value={ratingHalf !== null ? ratingHalf / 2 : null}
                onChange={(v) => setRatingHalf(Math.round(v * 2))}
                size="lg"
              />
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-dm-sans text-sm text-text-secondary">
                Review
              </span>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                placeholder="Optional"
                className="rounded-md border border-border-interactive bg-bg-surface p-3 font-source-serif-4 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="font-dm-sans text-sm text-text-secondary">
                Privacy
              </span>
              <div className="flex gap-2">
                {(['private', 'friends', 'public'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrivacy(p)}
                    className={cn(
                      'rounded-full border px-3 py-1 font-dm-sans text-sm transition-colors',
                      privacy === p
                        ? 'border-brand-ui bg-brand-subtle text-brand-subtle-text'
                        : 'border-border-subtle bg-bg-surface text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    {p === 'private'
                      ? 'Only me'
                      : p === 'friends'
                        ? 'Close friends'
                        : 'Public'}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="font-dm-sans text-sm text-error">{error}</p>
            )}

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
              <Button variant="ghost" size="md" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={submit}
                disabled={pending || !book}
              >
                {pending ? 'Saving' : 'Save entry'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
