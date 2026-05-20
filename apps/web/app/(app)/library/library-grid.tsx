'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { BookCoverPlaceholder } from '@/components/book-cover-placeholder'
import { StarRating } from '@/components/ui/star-rating'
import { cn } from '@/lib/cn'

export interface LibraryEntry {
  id: string
  status: 'reading' | 'want_to_read' | 'finished' | 'paused' | 'abandoned'
  progress_percentage: number | null
  rating_half: number | null
  rating: number | null
  finished_at: string | null
  created_at: string
  tags: string[]
  book: {
    id: string
    slug: string | null
    title: string
    author: string
    cover_url: string | null
  }
}

export function LibraryGrid({ items }: { items: LibraryEntry[] }) {
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const e of items) for (const t of e.tags) set.add(t)
    return [...set].sort()
  }, [items])

  const filtered = useMemo(() => {
    if (!activeTag) return items
    return items.filter((e) => e.tags.includes(activeTag))
  }, [items, activeTag])

  return (
    <div className="flex flex-col gap-6">
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
            Tags
          </span>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTag(activeTag === t ? null : t)}
              className={cn(
                'rounded-full border px-2.5 py-1 font-dm-mono text-xs transition-colors',
                activeTag === t
                  ? 'border-brand-ui bg-brand-subtle text-brand-subtle-text'
                  : 'border-border-subtle bg-bg-surface text-text-tertiary hover:bg-bg-hover',
              )}
              aria-pressed={activeTag === t}
            >
              {t}
            </button>
          ))}
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="font-dm-sans text-xs text-brand-text hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((entry) => (
          <LibraryCard
            key={entry.id}
            entry={entry}
            activeTag={activeTag}
            onTagClick={(t) =>
              setActiveTag(activeTag === t ? null : t)
            }
          />
        ))}
      </div>
    </div>
  )
}

function LibraryCard({
  entry,
  activeTag,
  onTagClick,
}: {
  entry: LibraryEntry
  activeTag: string | null
  onTagClick: (tag: string) => void
}) {
  const progress = Math.max(
    0,
    Math.min(100, Math.round(entry.progress_percentage ?? 0)),
  )
  return (
    <div className="group flex flex-col gap-2">
      <Link
        href={`/book/${entry.book.slug ?? entry.book.id}`}
        className="flex flex-col gap-2"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-bg-sunken shadow-sm transition-shadow group-hover:shadow-md">
          {entry.book.cover_url ? (
            <Image
              src={entry.book.cover_url}
              alt={entry.book.title}
              fill
              sizes="(max-width: 768px) 45vw, 18vw"
              className="object-cover"
            />
          ) : (
            <BookCoverPlaceholder
              title={entry.book.title}
              author={entry.book.author}
            />
          )}
          {entry.status === 'reading' && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-bg-sunken/70">
              <div
                className="h-full bg-brand-ui"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {entry.status === 'paused' && (
            <Badge variant="warning" className="absolute right-2 top-2">
              Paused
            </Badge>
          )}
          {entry.status === 'abandoned' && (
            <Badge variant="neutral" className="absolute right-2 top-2">
              Set aside
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="truncate font-fraunces text-sm text-text-primary">
            {entry.book.title}
          </p>
          <p className="truncate font-dm-sans text-xs text-text-tertiary">
            {entry.book.author}
          </p>
          {entry.status === 'finished' &&
            typeof entry.rating_half === 'number' && (
              <StarRating
                value={entry.rating_half / 2}
                size="sm"
                readOnly
              />
            )}
        </div>
      </Link>
      {entry.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {entry.tags.slice(0, 4).map((t) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => onTagClick(t)}
                className={cn(
                  'rounded-full px-1.5 py-0.5 font-dm-mono text-[10px] transition-colors',
                  activeTag === t
                    ? 'bg-brand-ui text-text-on-brand'
                    : 'bg-bg-sunken text-text-tertiary hover:bg-bg-hover',
                )}
                aria-pressed={activeTag === t}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
