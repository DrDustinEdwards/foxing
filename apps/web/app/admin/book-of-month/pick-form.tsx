'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { BookSearchAdd } from '@/components/book-search-add'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createPick, deletePick, updatePick } from './actions'

const CATEGORIES = [
  'fiction',
  'nonfiction',
  'debut',
  'classic',
  'poetry',
  'memoir',
  'translation',
] as const

interface BookSelection {
  id: string
  title: string
  author: string
  cover_url: string | null
  isbn: string | null
}

interface Props {
  mode: 'create' | 'edit'
  pickId?: string
  initial?: {
    book: BookSelection
    year: number
    month: number
    category: string
    curator_note: string | null
    amazon_url: string | null
    bookshop_url: string | null
    is_published: boolean
  }
}

const now = new Date()
const DEFAULT_YEAR = now.getUTCFullYear()
const DEFAULT_MONTH = now.getUTCMonth() + 1

export function PickForm({ mode, pickId, initial }: Props) {
  const [book, setBook] = useState<BookSelection | null>(initial?.book ?? null)
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
    if (mode === 'edit' && pickId) fd.set('id', pickId)
    startTransition(() => {
      void (async () => {
        try {
          if (mode === 'edit') {
            await updatePick(fd)
          } else {
            await createPick(fd)
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Could not save this pick.',
          )
        }
      })()
    })
  }

  function handleDelete() {
    if (!pickId) return
    if (!window.confirm('Remove this pick?')) return
    const fd = new FormData()
    fd.set('id', pickId)
    startTransition(() => {
      void (async () => {
        try {
          await deletePick(fd)
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Could not remove this pick.',
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
            placeholder="Search any book by title, author, or ISBN"
          />
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="month"
            className="font-dm-sans text-sm text-text-secondary"
          >
            Month
          </label>
          <select
            id="month"
            name="month"
            defaultValue={initial?.month ?? DEFAULT_MONTH}
            className="h-11 rounded-md border border-border-interactive bg-bg-surface px-3 font-dm-sans text-base text-text-primary"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleString('en-US', {
                  month: 'long',
                })}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Year"
          type="number"
          name="year"
          defaultValue={initial?.year ?? DEFAULT_YEAR}
          min={2020}
          max={2100}
          required
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="category"
            className="font-dm-sans text-sm text-text-secondary"
          >
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={initial?.category ?? 'fiction'}
            className="h-11 rounded-md border border-border-interactive bg-bg-surface px-3 font-dm-sans text-base text-text-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c[0]!.toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="curator_note"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Curator note
        </label>
        <textarea
          id="curator_note"
          name="curator_note"
          rows={4}
          maxLength={280}
          defaultValue={initial?.curator_note ?? ''}
          placeholder="What does this book actually do? One or two sentences."
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-base text-text-primary"
        />
        <span className="font-dm-mono text-xs text-text-tertiary">
          Write 1 or 2 sentences about why this book. Be specific. No em dashes,
          no &quot;a must-read&quot;, no &quot;compelling.&quot; Say what it
          actually does. 280 character cap.
        </span>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Amazon URL override"
          name="amazon_url"
          defaultValue={initial?.amazon_url ?? ''}
          placeholder="Leave blank to auto-build from ISBN"
        />
        <Input
          label="Bookshop URL override"
          name="bookshop_url"
          defaultValue={initial?.bookshop_url ?? ''}
          placeholder="Leave blank to auto-build from ISBN"
        />
      </section>

      <label className="flex items-center gap-2 font-dm-sans text-sm text-text-primary">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={initial?.is_published ?? false}
          className="h-4 w-4 rounded border-border-interactive"
        />
        Published
      </label>

      {error && (
        <p className="font-dm-sans text-sm text-error" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border-subtle pt-4">
        <Button type="submit" variant="primary" loading={pending}>
          {mode === 'edit' ? 'Save changes' : 'Create pick'}
        </Button>
        {mode === 'edit' && (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            loading={pending}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  )
}
