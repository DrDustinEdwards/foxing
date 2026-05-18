'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { formatRelativeDate } from '@foxing/utils'
import type { UserHighlight } from '@/lib/user-queries'

interface Props {
  items: UserHighlight[]
}

interface Group {
  book: UserHighlight['book']
  highlights: UserHighlight[]
}

const COLOR_LABELS: Record<string, string> = {
  amber: 'Key idea',
  auburn: 'Emotional',
  yellow: 'Important',
  sage: 'Love it',
  cobalt: 'Research',
  crimson: 'Question',
  purple: 'Disagree',
}

export function HighlightsBrowser({ items }: Props) {
  const [query, setQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<string | null>(null)

  const colors = useMemo(() => {
    const set = new Set<string>()
    for (const h of items) if (h.color) set.add(h.color)
    return [...set]
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((h) => {
      if (colorFilter && h.color !== colorFilter) return false
      if (!q) return true
      return (
        h.text.toLowerCase().includes(q) ||
        (h.note?.toLowerCase().includes(q) ?? false) ||
        h.book.title.toLowerCase().includes(q) ||
        h.book.author.toLowerCase().includes(q)
      )
    })
  }, [items, query, colorFilter])

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const h of filtered) {
      const g = map.get(h.book.id)
      if (g) g.highlights.push(h)
      else map.set(h.book.id, { book: h.book, highlights: [h] })
    }
    return [...map.values()]
  }, [filtered])

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search highlights, books, notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {colors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <ColorChip
              active={colorFilter === null}
              onClick={() => setColorFilter(null)}
              label="All colors"
              color={null}
            />
            {colors.map((c) => (
              <ColorChip
                key={c}
                active={colorFilter === c}
                onClick={() => setColorFilter(c)}
                label={COLOR_LABELS[c] ?? c}
                color={c}
              />
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="font-source-serif-4 text-base text-text-tertiary">
          Nothing matches. Try different terms.
        </p>
      ) : (
        <ul className="flex flex-col gap-8">
          {groups.map((g) => (
            <li key={g.book.id} className="flex flex-col gap-3">
              <header>
                <Link
                  href={`/book/${g.book.slug ?? g.book.id}`}
                  className="font-fraunces text-lg text-text-primary hover:text-brand-text"
                >
                  {g.book.title}
                </Link>
                <p className="font-dm-sans text-xs text-text-tertiary">
                  {g.book.author} · {g.highlights.length} highlights
                </p>
              </header>
              <ul className="flex flex-col gap-3">
                {g.highlights.map((h) => (
                  <HighlightRow key={h.id} highlight={h} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ColorChip({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean
  label: string
  color: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1 font-dm-sans text-xs transition-colors',
        active
          ? 'border-border-interactive bg-brand-subtle text-brand-subtle-text'
          : 'border-border-subtle bg-bg-surface text-text-tertiary hover:bg-bg-hover',
      )}
    >
      {color && (
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full"
          style={{ background: `var(--hl-${color})` }}
        />
      )}
      {label}
    </button>
  )
}

function HighlightRow({ highlight }: { highlight: UserHighlight }) {
  const color = highlight.color
  return (
    <li
      className="rounded-lg border-l-[3px] bg-bg-surface p-4 shadow-sm"
      style={{
        borderLeftColor: color
          ? `var(--hl-${color}-t, var(--brand-ui))`
          : 'var(--brand-ui)',
      }}
    >
      <blockquote className="font-source-serif-4 text-[15px] italic text-text-primary">
        {highlight.text}
      </blockquote>
      {highlight.note && (
        <p className="mt-2 font-source-serif-4 text-sm text-text-secondary">
          {highlight.note}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-dm-mono text-[11px] text-text-tertiary">
        <span>{formatRelativeDate(highlight.created_at)}</span>
        {highlight.chapter && (
          <Badge variant="neutral">{highlight.chapter}</Badge>
        )}
        {highlight.is_public ? (
          <Badge variant="info">Public</Badge>
        ) : (
          <Badge variant="neutral">Private</Badge>
        )}
      </div>
    </li>
  )
}
