'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { removeAnnouncement } from './actions'

export function RemoveAnnouncementButton({
  id,
  clubId,
}: {
  id: string
  clubId: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm('Remove this announcement?')) return
        setPending(true)
        const fd = new FormData()
        fd.set('id', id)
        fd.set('club_id', clubId)
        await removeAnnouncement(fd)
        setPending(false)
        router.refresh()
      }}
      className="font-dm-sans text-xs text-text-tertiary hover:text-error disabled:opacity-50"
    >
      {pending ? 'Removing...' : 'Remove'}
    </button>
  )
}
