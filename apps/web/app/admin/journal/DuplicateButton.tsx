'use client'

import { useState } from 'react'
import { duplicateJournalPost } from './actions'

export function DuplicateButton({ id, title }: { id: string; title: string }) {
  const [pending, setPending] = useState(false)

  async function handle() {
    if (
      !window.confirm(
        `Duplicate "${title}"? A draft copy will open in the editor.`,
      )
    )
      return
    setPending(true)
    const fd = new FormData()
    fd.set('id', id)
    try {
      await duplicateJournalPost(fd)
    } finally {
      // The action redirects on success; only reached on a no-op.
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="font-dm-sans text-sm text-text-tertiary hover:text-text-primary disabled:opacity-50"
    >
      {pending ? 'Duplicating...' : 'Duplicate'}
    </button>
  )
}
