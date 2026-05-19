'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { unsaveClubPost } from '@/app/clubs/[slug]/actions'

export function UnsaveButton({ postId }: { postId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        const fd = new FormData()
        fd.set('post_id', postId)
        await unsaveClubPost(fd)
        setPending(false)
        router.refresh()
      }}
      className="font-dm-mono text-xs text-text-tertiary hover:text-error disabled:opacity-50"
    >
      {pending ? 'Removing...' : 'Remove'}
    </button>
  )
}
