'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

export interface BookHit {
  id: string
  title: string
  author: string
  cover_url: string | null
  slug: string | null
}

async function searchBooks(
  query: string,
  signal: AbortSignal,
): Promise<BookHit[]> {
  const res = await fetch(
    `/api/search/books?q=${encodeURIComponent(query)}&limit=8`,
    { signal },
  )
  if (!res.ok) return []
  return (await res.json()) as BookHit[]
}

interface Props {
  selected: BookHit | null
  onSelect: (book: BookHit | null) => void
  label?: string
  placeholder?: string
  hint?: string
}

/**
 * Single-select book picker over the Foxing catalog. Type a title or author,
 * pick a result, and the selected book is surfaced to the parent (which reads
 * `book.id`). Shared widget for the club current-read picker, the Goodreads
 * import matcher, and the barcode scanner.
 */
export function BookSearchPicker({
  selected,
  onSelect,
  label = 'Book',
  placeholder = 'Search by title or author',
  hint,
}: Props) {
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
    const controller = new AbortController()
    debouncer.current = setTimeout(async () => {
      try {
        const results = await searchBooks(query.trim(), controller.signal)
        setHits(results)
        setOpen(true)
      } catch {
        // aborted or failed; keep the prior results in place
      }
    }, 250)
    return () => {
      controller.abort()
      if (debouncer.current) clearTimeout(debouncer.current)
    }
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
        label={label}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        hint={hint}
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
