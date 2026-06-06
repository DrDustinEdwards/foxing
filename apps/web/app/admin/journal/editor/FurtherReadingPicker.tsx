'use client'

import { useEffect, useState } from 'react'
import type { LinkedPost } from './types'

export function FurtherReadingPicker({
  selfId,
  linked,
  onChange,
}: {
  selfId: string | null
  linked: LinkedPost[]
  onChange: (next: LinkedPost[]) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LinkedPost[]>([])
  const [searching, setSearching] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let alive = true
    const handle = window.setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/admin/journal/posts/search?q=${encodeURIComponent(q)}`,
        )
        if (!res.ok) {
          setResults([])
          return
        }
        const data = (await res.json()) as { results?: LinkedPost[] }
        if (alive) setResults(data.results ?? [])
      } finally {
        if (alive) setSearching(false)
      }
    }, 200)
    return () => {
      alive = false
      window.clearTimeout(handle)
    }
  }, [query])

  function add(p: LinkedPost) {
    if (p.id === selfId) return
    if (linked.some((x) => x.id === p.id)) return
    onChange([...linked, p])
    setQuery('')
    setResults([])
  }

  function remove(id: string) {
    onChange(linked.filter((p) => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface p-4">
      <p className="font-dm-sans text-sm text-text-secondary">
        Further reading
      </p>
      <p className="font-dm-mono text-xs text-text-tertiary">
        Curated links shown at the end of this article.
      </p>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts by title..."
          className="w-full rounded-md border border-border-subtle bg-bg-base px-3 py-2 font-dm-sans text-sm text-text-primary focus:border-brand-ui focus:outline-none"
        />
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border border-border-subtle bg-bg-surface shadow-lg">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => add(r)}
                  disabled={r.id === selfId || linked.some((x) => x.id === r.id)}
                  className="flex w-full flex-col px-3 py-2 text-left font-dm-sans text-sm text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{r.title}</span>
                  <span className="font-dm-mono text-xs text-text-tertiary">
                    /journal/{r.slug}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && results.length === 0 && query.trim() && (
          <p className="absolute left-0 top-full mt-1 font-dm-mono text-xs text-text-tertiary">
            Searching...
          </p>
        )}
      </div>
      {linked.length > 0 && (
        <ol className="flex flex-col gap-1">
          {linked.map((p, i) => (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(i)
              }}
              onDrop={() => {
                if (dragIndex === null || dragIndex === i) {
                  setDragIndex(null)
                  setDragOverIndex(null)
                  return
                }
                const copy = linked.slice()
                const [moved] = copy.splice(dragIndex, 1)
                copy.splice(i, 0, moved)
                onChange(copy)
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              className={`flex cursor-grab items-center justify-between gap-2 rounded-md border bg-bg-base px-3 py-2 font-dm-sans text-sm text-text-primary transition-colors active:cursor-grabbing ${
                dragOverIndex === i
                  ? 'border-brand-ui bg-brand-subtle'
                  : 'border-border-subtle'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="select-none font-dm-mono text-text-tertiary"
                >
                  ⠿
                </span>
                <span className="min-w-0 truncate">{p.title}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="shrink-0 px-2 font-dm-mono text-xs text-text-tertiary hover:text-error"
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
