'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface DbResult {
  source: 'db'
  id: string
  title: string
  author: string
  cover_url: string | null
  isbn: string | null
  publication_year: number | null
}

interface OpenLibraryResult {
  source: 'open_library'
  key: string
  title: string
  author: string
  cover_url: string | null
  isbn: string | null
  publication_year: number | null
}

type Result = DbResult | OpenLibraryResult

interface SelectedBook {
  id: string
  title: string
  author: string
  cover_url: string | null
  isbn: string | null
}

interface Props {
  onSelect: (book: SelectedBook) => void
  placeholder?: string
  autoFocus?: boolean
  hint?: string
}

export function BookSearchAdd({
  onSelect,
  placeholder,
  autoFocus,
  hint,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const looksLikeIsbn = /^[\d\sxX-]{10,}$/.test(q.trim())
      const url = `/api/books/search?q=${encodeURIComponent(q.trim())}${
        looksLikeIsbn ? '&type=isbn' : ''
      }`
      const res = await fetch(url)
      if (!res.ok) throw new Error('search_failed')
      const json = (await res.json()) as { results: Result[] }
      if (id === requestId.current) setResults(json.results)
    } catch {
      if (id === requestId.current) {
        setError('Search failed. Try again.')
        setResults([])
      }
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  async function handleAddOpenLibrary(r: OpenLibraryResult) {
    setAdding(r.key)
    setError(null)
    try {
      const res = await fetch('/api/books/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openLibraryKey: r.key,
          title: r.title,
          author: r.author,
          cover_url: r.cover_url,
          isbn: r.isbn,
          publication_year: r.publication_year,
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string; limit?: number }
        if (json.error === 'rate_limited') {
          setError(`Daily limit reached. ${json.limit ?? 5} new books per day.`)
        } else {
          setError('Could not add this book. Try again.')
        }
        return
      }
      const json = (await res.json()) as { id: string }
      onSelect({
        id: json.id,
        title: r.title,
        author: r.author,
        cover_url: r.cover_url,
        isbn: r.isbn,
      })
    } finally {
      setAdding(null)
    }
  }

  function handleSelectDb(r: DbResult) {
    onSelect({
      id: r.id,
      title: r.title,
      author: r.author,
      cover_url: r.cover_url,
      isbn: r.isbn,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Search by title, author, or ISBN"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Frankenstein, Mary Shelley, 9780486282114'}
        hint={hint}
      />
      {error && (
        <p className="font-dm-sans text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="font-dm-mono text-xs text-text-tertiary">Searching...</p>
      )}
      {!loading && results.length === 0 && query.trim().length >= 2 && (
        <p className="font-dm-sans text-sm text-text-tertiary">
          No matches. Try a different spelling.
        </p>
      )}
      {results.length > 0 && (
        <ul className="flex max-h-[480px] flex-col gap-2 overflow-y-auto rounded-md border border-border-subtle bg-bg-surface p-2">
          {results.map((r) => (
            <li
              key={r.source === 'db' ? `db-${r.id}` : `ol-${r.key}`}
              className="flex items-start gap-3 rounded-md border border-transparent p-2 hover:border-border-subtle"
            >
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-bg-sunken">
                {r.cover_url && (
                  <Image
                    src={r.cover_url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-fraunces text-base text-text-primary">
                  {r.title}
                </p>
                <p className="truncate font-dm-sans text-sm text-text-secondary">
                  {r.author}
                </p>
                <p className="font-dm-mono text-xs text-text-tertiary">
                  {r.source === 'db'
                    ? 'In Foxing'
                    : `Open Library${r.publication_year ? ` · ${r.publication_year}` : ''}`}
                  {r.isbn ? ` · ${r.isbn}` : ''}
                </p>
              </div>
              <div className="shrink-0">
                {r.source === 'db' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSelectDb(r)}
                  >
                    Select
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={adding === r.key}
                    onClick={() => handleAddOpenLibrary(r)}
                  >
                    Add
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
