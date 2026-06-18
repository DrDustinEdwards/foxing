'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { BookSearchPicker, type BookHit } from '@/components/book-search-picker'
import { createClub } from './actions'

type Mode = 'community' | 'book'

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

      {mode === 'book' && (
        <BookSearchPicker
          selected={book}
          onSelect={setBook}
          label="Book"
          placeholder="Search by title or author"
        />
      )}

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
