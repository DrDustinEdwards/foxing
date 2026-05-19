'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteBuddyReadPost, finishBuddyRead } from '../actions'

export function DeletePostButton({
  postId,
  buddyReadId,
}: {
  postId: string
  buddyReadId: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm('Delete this post?')) return
        setPending(true)
        const fd = new FormData()
        fd.set('post_id', postId)
        fd.set('buddy_read_id', buddyReadId)
        await deleteBuddyReadPost(fd)
        setPending(false)
        router.refresh()
      }}
      className="font-dm-mono text-xs text-text-tertiary hover:text-error disabled:opacity-50"
    >
      {pending ? 'Deleting...' : 'Delete'}
    </button>
  )
}

export function FinishBuddyReadButton({
  buddyReadId,
}: {
  buddyReadId: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm('Mark this buddy read as finished?')) return
        setPending(true)
        const fd = new FormData()
        fd.set('buddy_read_id', buddyReadId)
        await finishBuddyRead(fd)
        setPending(false)
        router.refresh()
      }}
      className="rounded-md border border-border-default bg-bg-surface px-3 py-1.5 font-dm-sans text-sm text-text-secondary hover:border-border-interactive disabled:opacity-50"
    >
      {pending ? 'Saving...' : 'Mark as finished'}
    </button>
  )
}
