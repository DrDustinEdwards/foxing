'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatRelativeDate } from '@foxing/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import {
  deleteCommonplaceEntry,
  toggleCommonplacePrivacy,
} from './actions'

interface Entry {
  id: string
  passage_text: string
  book_title: string | null
  book_slug: string | null
  book_id: string | null
  book_author: string | null
  note: string | null
  is_public: boolean
  created_at: string
}

type Filter = 'all' | 'public' | 'private'

export function CommonplaceList({ entries }: { entries: Entry[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [pending, setPending] = useState<string | null>(null)

  const visible = entries.filter((e) =>
    filter === 'all'
      ? true
      : filter === 'public'
        ? e.is_public
        : !e.is_public,
  )

  function buildExportText(): string {
    return entries
      .map((e) => {
        const lines = [`"${e.passage_text}"`]
        if (e.book_title || e.book_author) {
          const tag = [e.book_title, e.book_author].filter(Boolean).join(' by ')
          lines.push(`- ${tag}`)
        }
        if (e.note) lines.push(e.note)
        return lines.join('\n')
      })
      .join('\n\n---\n\n')
  }

  function handleExport() {
    const text = buildExportText()
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'commonplace-book.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this passage from your commonplace book?')) return
    setPending(id)
    const fd = new FormData()
    fd.set('id', id)
    await deleteCommonplaceEntry(fd)
    setPending(null)
    router.refresh()
  }

  async function handleToggle(id: string) {
    setPending(id)
    const fd = new FormData()
    fd.set('id', id)
    await toggleCommonplacePrivacy(fd)
    setPending(null)
    router.refresh()
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {(['all', 'public', 'private'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1 font-dm-sans text-sm',
                filter === f
                  ? 'bg-brand-subtle text-brand-subtle-text'
                  : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleExport}>
            Export
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="font-source-serif-4 text-base text-text-tertiary">
          {filter === 'all'
            ? 'Your commonplace book is empty. Long-press any passage in the reader and choose "Add to commonplace book" to save it here.'
            : `No ${filter} entries.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((e) => {
            const bookPath = e.book_slug ?? e.book_id
            const bookTitle = e.book_title
            const author = e.book_author
            return (
              <li
                key={e.id}
                className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4"
              >
                <blockquote className="border-l-2 border-brand-ui pl-4 font-source-serif-4 text-base italic text-text-primary">
                  {e.passage_text}
                </blockquote>
                <div className="flex flex-wrap items-center justify-between gap-2 font-dm-mono text-xs text-text-tertiary">
                  <div className="flex flex-wrap items-baseline gap-2">
                    {bookTitle && bookPath ? (
                      <Link
                        href={`/book/${bookPath}`}
                        className="text-text-secondary hover:text-text-primary"
                      >
                        {bookTitle}
                        {author && ` by ${author}`}
                      </Link>
                    ) : bookTitle ? (
                      <span>
                        {bookTitle}
                        {author && ` by ${author}`}
                      </span>
                    ) : null}
                    <span>· {formatRelativeDate(e.created_at)}</span>
                    <Badge variant={e.is_public ? 'success' : 'neutral'}>
                      {e.is_public ? 'Public' : 'Private'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(e.id)}
                      disabled={pending === e.id}
                      className="hover:text-text-primary disabled:opacity-50"
                    >
                      Make {e.is_public ? 'private' : 'public'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id)}
                      disabled={pending === e.id}
                      className="hover:text-error disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {e.note && (
                  <p className="font-source-serif-4 text-sm text-text-secondary">
                    {e.note}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
