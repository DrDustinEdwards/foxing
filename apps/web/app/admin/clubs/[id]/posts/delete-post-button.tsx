'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { deleteClubPost } from './actions'

export function DeletePostButton({
  postId,
  clubId,
}: {
  postId: string
  clubId: string
}) {
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleClick() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setPending(true)
    const fd = new FormData()
    fd.set('postId', postId)
    fd.set('clubId', clubId)
    await deleteClubPost(fd)
    setPending(false)
    setDone(true)
  }

  if (done) {
    return (
      <span className="font-dm-mono text-xs text-text-tertiary">Deleted</span>
    )
  }
  return (
    <Button
      variant="danger"
      size="sm"
      onClick={handleClick}
      loading={pending}
    >
      Delete
    </Button>
  )
}
