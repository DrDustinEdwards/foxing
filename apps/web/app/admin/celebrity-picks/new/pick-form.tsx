'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { BookSearchAdd } from '@/components/book-search-add'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createCelebrityPick } from '../actions'

interface BookSelection {
  id: string
  title: string
  author: string
  cover_url: string | null
  isbn: string | null
}

interface ClubOption {
  id: string
  slug: string
  name: string
}

interface Props {
  clubs: ClubOption[]
}

const now = new Date()
const DEFAULT_YEAR = now.getUTCFullYear()
const DEFAULT_MONTH = now.getUTCMonth() + 1

export function CelebrityPickForm({ clubs }: Props) {
  const [book, setBook] = useState<BookSelection | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!book) {
      setError('Pick a book first.')
      return
    }
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('book_id', book.id)
    startTransition(() => {
      void (async () => {
        try {
          await createCelebrityPick(fd)
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Could not save this pick.',
          )
        }
      })()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-fraunces text-xl text-text-primary">Book</h2>
        {book ? (
          <div className="flex items-center gap-4 rounded-md border border-border-subtle bg-bg-surface p-3">
            <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-bg-sunken">
              {book.cover_url && (
                <Image
                  src={book.cover_url}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-fraunces text-base text-text-primary">
                {book.title}
              </p>
              <p className="font-dm-sans text-sm text-text-secondary">
                {book.author}
              </p>
              {book.isbn && (
                <p className="font-dm-mono text-xs text-text-tertiary">
                  ISBN {book.isbn}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBook(null)}
            >
              Change
            </Button>
          </div>
        ) : (
          <BookSearchAdd
            onSelect={setBook}
            placeholder="Search by title, author, or ISBN"
          />
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="club_id"
            className="font-dm-sans text-sm text-text-secondary"
          >
            Club
          </label>
          <Select
            id="club_id"
            name="club_id"
            required
            size="md"
            defaultValue=""
            options={[
              { value: '', label: 'Choose a club' },
              ...clubs.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="pick_month"
            className="font-dm-sans text-sm text-text-secondary"
          >
            Month
          </label>
          <Select
            id="pick_month"
            name="pick_month"
            size="md"
            defaultValue={String(DEFAULT_MONTH)}
            options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
              value: String(m),
              label: new Date(2000, m - 1, 1).toLocaleString('en-US', {
                month: 'long',
              }),
            }))}
          />
        </div>
        <Input
          label="Year"
          type="number"
          name="pick_year"
          defaultValue={DEFAULT_YEAR}
          min={1990}
          max={2100}
          required
        />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Category" name="category" placeholder="fiction, memoir, debut" />
        <Input
          label="Official URL"
          name="official_url"
          placeholder="https://oprah.com/..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="notes"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          placeholder="Optional context. Be specific. No em dashes, no compelling, no must-read."
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-base text-text-primary"
        />
      </div>

      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-primary">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked
          className="h-4 w-4 rounded border-border-interactive accent-toggle-on"
        />
        Published
      </label>

      {error && (
        <p className="font-dm-sans text-sm text-error" role="alert">
          {error}
        </p>
      )}

      <div className="border-t border-border-subtle pt-4">
        <Button type="submit" variant="primary" loading={pending}>
          Create pick
        </Button>
      </div>
    </form>
  )
}
