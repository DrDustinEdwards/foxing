'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChipInput } from '@/components/ui/chip-input'
import { Input } from '@/components/ui/input'
import { clearAiCache, updateBook } from './actions'

interface BookData {
  id: string
  title: string
  author: string
  description: string | null
  cover_url: string | null
  themes: string[] | null
  mood_tags: string[] | null
  content_warnings: string[] | null
  pacing: string | null
  is_staff_pick: boolean | null
  staff_pick_note: string | null
  isbn: string | null
  isbn13: string | null
  publication_year: number | null
  reading_difficulty: number | null
  word_count: number | null
}

const MOOD_SUGGESTIONS = [
  'dark',
  'lighthearted',
  'emotional',
  'tense',
  'hopeful',
  'funny',
  'mysterious',
  'adventurous',
  'reflective',
  'romantic',
] as const

const PACING_OPTIONS = ['slow', 'medium', 'fast'] as const

interface Props {
  book: BookData
  cacheCount: number
}

export function BookEditForm({ book, cacheCount }: Props) {
  const [coverUrl, setCoverUrl] = useState(book.cover_url ?? '')
  const [staffPick, setStaffPick] = useState(Boolean(book.is_staff_pick))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cacheStatus, setCacheStatus] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    fd.set('id', book.id)
    await updateBook(fd)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleClear() {
    if (
      !window.confirm(
        'Delete all AI cache entries for this book? Content will regenerate on next request.',
      )
    )
      return
    setClearing(true)
    setCacheStatus(null)
    const fd = new FormData()
    fd.set('id', book.id)
    await clearAiCache(fd)
    setClearing(false)
    setCacheStatus('Cleared. AI content will regenerate on next request.')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input label="Title" name="title" defaultValue={book.title} required />
      <Input label="Author" name="author" defaultValue={book.author} required />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="font-dm-sans text-sm text-text-secondary"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={book.description ?? ''}
          rows={6}
          maxLength={500}
          className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
        />
        <span className="font-dm-mono text-xs text-text-tertiary">
          500 character cap. No em dashes.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_120px]">
        <Input
          label="Cover URL"
          name="cover_url"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://..."
        />
        {coverUrl && (
          <div className="flex items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="Cover preview"
              className="h-32 w-24 rounded border border-border-subtle object-cover"
            />
          </div>
        )}
      </div>

      <ChipInput
        label="Themes"
        name="themes"
        initial={book.themes ?? []}
        suggestions={MOOD_SUGGESTIONS}
        hint="Themes drive mood-based browsing. Use the same vocabulary as moods."
      />

      <ChipInput
        label="Mood tags"
        name="mood_tags"
        initial={book.mood_tags ?? []}
        suggestions={MOOD_SUGGESTIONS}
        hint="What this book feels like to read."
      />

      <ChipInput
        label="Content warnings"
        name="content_warnings"
        initial={book.content_warnings ?? []}
        suggestions={[
          'violence',
          'sexual assault',
          'suicide',
          'self-harm',
          'abuse',
          'racism',
          'antisemitism',
          'animal cruelty',
        ]}
        placeholder="e.g. violence, suicide, abuse"
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="font-dm-sans text-sm text-text-secondary">
          Pacing
        </legend>
        <div className="flex gap-4">
          {PACING_OPTIONS.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 font-dm-sans text-sm text-text-primary"
            >
              <input
                type="radio"
                name="pacing"
                value={opt}
                defaultChecked={book.pacing === opt}
              />
              <span className="capitalize">{opt}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 font-dm-sans text-sm text-text-tertiary">
            <input type="radio" name="pacing" value="" defaultChecked={!book.pacing} />
            <span>Unset</span>
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-3">
        <Input
          label="ISBN-10"
          name="isbn"
          defaultValue={book.isbn ?? ''}
          placeholder="0451524934"
        />
        <Input
          label="ISBN-13"
          name="isbn13"
          defaultValue={book.isbn13 ?? ''}
          placeholder="9780451524935"
        />
        <Input
          label="Publication year"
          type="number"
          name="publication_year"
          defaultValue={book.publication_year ?? ''}
          min={0}
          max={2100}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Reading difficulty"
          type="number"
          name="reading_difficulty"
          defaultValue={book.reading_difficulty ?? ''}
          min={1}
          max={10}
          step={0.1}
        />
        <Input
          label="Word count"
          type="number"
          name="word_count"
          defaultValue={book.word_count ?? ''}
          min={0}
          step={1}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-sunken p-4">
        <label className="flex items-center gap-2 font-dm-sans text-sm text-text-primary">
          <input
            type="checkbox"
            name="is_staff_pick"
            checked={staffPick}
            onChange={(e) => setStaffPick(e.target.checked)}
            className="h-4 w-4 rounded border-border-interactive"
          />
          Staff pick
        </label>
        {staffPick && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="staff_pick_note"
              className="font-dm-sans text-sm text-text-secondary"
            >
              Staff pick note
            </label>
            <textarea
              id="staff_pick_note"
              name="staff_pick_note"
              rows={3}
              maxLength={280}
              defaultValue={book.staff_pick_note ?? ''}
              placeholder="One or two sentences on why this is a pick. Be specific."
              className="rounded-md border border-border-interactive bg-bg-surface px-3 py-2 font-source-serif-4 text-sm text-text-primary"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" loading={saving}>
            Save changes
          </Button>
          {saved && (
            <span className="font-dm-mono text-xs text-success">Saved</span>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleClear}
          loading={clearing}
        >
          Clear AI cache ({cacheCount})
        </Button>
      </div>
      {cacheStatus && (
        <p className="font-dm-mono text-xs text-text-tertiary">{cacheStatus}</p>
      )}
    </form>
  )
}
