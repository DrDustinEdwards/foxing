'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createBuddyRead } from '../actions'

interface BookHit {
  id: string
  title: string
  author: string
  cover_url: string | null
  slug: string | null
}

interface UserHit {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

async function searchBooks(query: string): Promise<BookHit[]> {
  const res = await fetch(
    `/api/search/books?q=${encodeURIComponent(query)}&limit=8`,
  )
  if (!res.ok) return []
  return (await res.json()) as BookHit[]
}

async function searchUsers(query: string): Promise<UserHit[]> {
  const res = await fetch(
    `/api/search/users?q=${encodeURIComponent(query)}&limit=8`,
  )
  if (!res.ok) return []
  return (await res.json()) as UserHit[]
}

export function InviteForm() {
  const [book, setBook] = useState<BookHit | null>(null)
  const [partner, setPartner] = useState<UserHit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!book || !partner) {
      setError('Pick a book and a partner.')
      return
    }
    setSubmitting(true)
    const fd = new FormData()
    fd.set('book_id', book.id)
    fd.set('partner_id', partner.id)
    try {
      await createBuddyRead(fd)
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : 'Could not start.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-5 rounded-lg border border-border-subtle bg-bg-surface p-5"
    >
      <BookPicker selected={book} onSelect={setBook} />
      <UserPicker selected={partner} onSelect={setPartner} />
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
          disabled={!book || !partner}
        >
          Start buddy read
        </Button>
      </div>
    </form>
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

function UserPicker({
  selected,
  onSelect,
}: {
  selected: UserHit | null
  onSelect: (u: UserHit | null) => void
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
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
      const results = await searchUsers(query.trim())
      setHits(results)
      setOpen(true)
    }, 250)
  }, [query, selected])

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-bg-sunken p-3">
        <Avatar
          src={selected.avatar_url}
          name={selected.display_name}
          size="md"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-dm-sans text-sm font-medium text-text-primary">
            {selected.display_name}
          </span>
          <span className="font-dm-mono text-xs text-text-tertiary">
            @{selected.username}
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
        label="Friend"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username or display name"
        autoComplete="off"
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border-default bg-bg-elevated shadow-md">
          {hits.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(u)
                  setOpen(false)
                  setQuery(u.display_name)
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-bg-hover"
              >
                <Avatar
                  src={u.avatar_url}
                  name={u.display_name}
                  size="sm"
                />
                <span className="flex flex-col">
                  <span className="font-dm-sans text-sm text-text-primary">
                    {u.display_name}
                  </span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    @{u.username}
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
