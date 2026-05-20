'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { toggleBookOnShelf } from '@/app/(app)/shelves/actions'

interface ShelfOption {
  id: string
  name: string
  is_public: boolean
}

interface Props {
  bookId: string
  shelves: ShelfOption[]
  initialMembership: string[]
}

export function BookShelvesPicker({
  bookId,
  shelves,
  initialMembership,
}: Props) {
  const router = useRouter()
  const [membership, setMembership] = useState(new Set(initialMembership))
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(shelfId: string) {
    setError(null)
    setPending(shelfId)
    const wantAdd = !membership.has(shelfId)
    const next = new Set(membership)
    if (wantAdd) next.add(shelfId)
    else next.delete(shelfId)
    setMembership(next)
    const fd = new FormData()
    fd.set('shelf_id', shelfId)
    fd.set('book_id', bookId)
    fd.set('add', wantAdd ? 'true' : 'false')
    const res = await toggleBookOnShelf(fd)
    setPending(null)
    if (!res.ok) {
      const revert = new Set(membership)
      setMembership(revert)
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
        Add to shelves
      </p>
      {shelves.length === 0 ? (
        <p className="font-source-serif-4 text-sm text-text-tertiary">
          You have no shelves yet.{' '}
          <Link href="/shelves" className="text-brand-text hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {shelves.map((s) => {
            const active = membership.has(s.id)
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  disabled={pending === s.id}
                  aria-pressed={active}
                  className={cn(
                    'rounded-full border px-3 py-1 font-dm-sans text-xs transition-colors disabled:opacity-50',
                    active
                      ? 'border-brand-ui bg-brand-subtle text-brand-subtle-text'
                      : 'border-border-subtle bg-bg-surface text-text-tertiary hover:bg-bg-hover',
                  )}
                >
                  {s.name}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <p className="font-dm-sans text-xs text-error">{error}</p>
      )}
    </div>
  )
}
