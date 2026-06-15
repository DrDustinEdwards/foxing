'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { createClub } from './actions'

interface BookHit {
  id: string
  title: string
  author: string
  cover_url: string | null
  slug: string | null
}

type Mode = 'community' | 'book'

async function searchBooks(query: string): Promise<BookHit[]> {
  const res = await fetch(
    `/api/search/books?q=${encodeURIComponent(query)}&limit=8`,
  )
  if (!res.ok) return []
  return (await res.json()) as BookHit[]
}

export function CreateClubForm() {
  const [mode, setMode] = useState<Mode>('community')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [pace, setPace] = useState<'relaxed' | 'moderate' | 'intensive'>(
    'moderate',
  )
  const [book, setBook] = useState<BookHit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Give your club a name.')
      return
    }
    if (mode === 'book' && !book) {
      setError('Pick a book, or switch to a community.')
      return
    }
    setSubmitting(true)
    const fd = new FormData()
    fd.set('name', name.trim())
    fd.set('description', description.trim())
    fd.set('visibility', visibility)
    fd.set('reading_pace', pace)
    if (mode === 'book' && book) fd.set('book_id', book.id)
    try {
      // Success redirects server-side (no return value); a failure comes back
      // as { ok: false, error } so we can show a real message.
      const res = await createClub(fd)
      if (res && !res.ok) {
        setSubmitting(false)
        setError(res.error)
      }
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'Could not create the club.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-lg border border-border-subtle bg-bg-surface p-5"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-dm-sans text-sm font-medium text-text-primary">
          What kind of club?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PathButton
            active={mode === 'community'}
            title="Start a community"
            subtitle="A standing group, no single book"
            onClick={() => setMode('community')}
          />
          <PathButton
            active={mode === 'book'}
            title="Start around a book"
            subtitle="Gather readers for one book"
            onClick={() => setMode('book')}
          />
        </div>
      </fieldset>

      <Input
        label="Club name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="The Tuesday Night Readers"
        maxLength={120}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="club-description"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Description
        </label>
        <textarea
          id="club-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What is this club about?"
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
      </div>

      {mode === 'book' && <BookPicker selected={book} onSelect={setBook} />}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-dm-sans text-sm font-medium text-text-primary">
          Visibility
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PathButton
            active={visibility === 'public'}
            title="Public"
            subtitle="Anyone can find and join"
            onClick={() => setVisibility('public')}
          />
          <PathButton
            active={visibility === 'private'}
            title="Private"
            subtitle="Visible only to members"
            onClick={() => setVisibility('private')}
          />
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 font-dm-sans text-sm text-text-secondary">
        <span>Reading pace</span>
        <Select
          aria-label="Reading pace"
          value={pace}
          onChange={(v) =>
            setPace(v as 'relaxed' | 'moderate' | 'intensive')
          }
          options={[
            { value: 'relaxed', label: 'Relaxed' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'intensive', label: 'Intensive' },
          ]}
          className="w-full"
        />
      </label>

      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={submitting}
          disabled={!name.trim() || (mode === 'book' && !book)}
        >
          Create club
        </Button>
      </div>
    </form>
  )
}

function PathButton({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'flex flex-col rounded-md border p-3 text-left transition-colors ' +
        (active
          ? 'border-border-interactive bg-brand-subtle'
          : 'border-border-subtle hover:border-border-interactive')
      }
    >
      <span className="font-dm-sans text-sm font-medium text-text-primary">
        {title}
      </span>
      <span className="font-dm-sans text-xs text-text-tertiary">
        {subtitle}
      </span>
    </button>
  )
}

function BookPicker({
  selected,
  onSelect,
}: {
  selected: BookHit | null
  onSelect: (book: BookHit | null) => void
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<BookHit[]>([])
  const [open, setOpen] = useState(false)
  const debouncer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selected) return
    if (debouncer.current) clearTimeout(debouncer.current)
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    debouncer.current = setTimeout(async () => {
      const results = await searchBooks(query.trim())
      setHits(results)
      setOpen(true)
    }, 250)
  }, [query, selected])

  if (selected) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border-subtle bg-bg-sunken p-3">
        <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-sm bg-bg-surface">
          {selected.cover_url && (
            <Image
              src={selected.cover_url}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-fraunces text-base text-text-primary">
            {selected.title}
          </span>
          <span className="font-dm-sans text-xs text-text-tertiary">
            {selected.author}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null)
            setQuery('')
          }}
          className="font-dm-sans text-xs text-text-tertiary hover:text-error"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        label="Book"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title"
        autoComplete="off"
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border-default bg-bg-elevated shadow-md">
          {hits.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(b)
                  setOpen(false)
                  setQuery(b.title)
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-bg-hover"
              >
                <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-bg-sunken">
                  {b.cover_url && (
                    <Image
                      src={b.cover_url}
                      alt=""
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  )}
                </span>
                <span className="flex flex-col">
                  <span className="font-fraunces text-sm text-text-primary">
                    {b.title}
                  </span>
                  <span className="font-dm-sans text-xs text-text-tertiary">
                    {b.author}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
