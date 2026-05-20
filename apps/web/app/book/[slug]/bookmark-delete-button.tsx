'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteBookmark } from './actions'

export function BookmarkDeleteButton({
  bookmarkId,
  bookSlug,
}: {
  bookmarkId: string
  bookSlug: string | null
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm('Delete this bookmark?')) return
        setPending(true)
        const fd = new FormData()
        fd.set('bookmark_id', bookmarkId)
        if (bookSlug) fd.set('book_slug', bookSlug)
        await deleteBookmark(fd)
        setPending(false)
        router.refresh()
      }}
      className="font-dm-mono text-xs text-text-tertiary hover:text-error disabled:opacity-50"
    >
      {pending ? 'Removing...' : 'Delete'}
    </button>
  )
}
