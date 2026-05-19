'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cancelClubMeeting } from './actions'

export function CancelMeetingButton({
  meetingId,
  clubId,
}: {
  meetingId: string
  clubId: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        if (!confirm('Cancel this meeting?')) return
        setPending(true)
        const fd = new FormData()
        fd.set('meeting_id', meetingId)
        fd.set('club_id', clubId)
        await cancelClubMeeting(fd)
        setPending(false)
        router.refresh()
      }}
      className="text-text-tertiary hover:text-error disabled:opacity-50"
    >
      {pending ? 'Cancelling...' : 'Cancel meeting'}
    </button>
  )
}
